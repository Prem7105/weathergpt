/**
 * WeatherGPT - Microsoft Aurora 1.5 Ensemble Foundation Service Layer
 * 
 * Provides:
 * 1. Background worker invocation with disk-backed JSON caching (6h TTL).
 * 2. Multi-member ensemble forecast extraction (mean & ensemble uncertainty spread).
 * 3. Strict runtime status reporting: ACTIVE | NOT_CONFIGURED | UNAVAILABLE | DEGRADED.
 * 4. Transparent data honesty: never fakes foundation model outputs or accuracy.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const CACHE_DIR = path.join(process.cwd(), 'ml', 'aurora', 'cache');
const CACHE_TTL_MS = 6 * 3600 * 1000; // 6 hours

export const AURORA_CONFIG = {
  modelName: 'Aurora 0.25° Small Pretrained — Research Mode',
  checkpointId: 'microsoft/aurora (aurora-0.25-small-pretrained.ckpt)',
  resolutionDeg: 0.25,
  pressureLevelsHpa: [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 925, 1000],
  atmospheric3dVariables: ['z', 't', 'u', 'v', 'q'],
  surface2dVariables: ['2t', '10u', '10v', 'msl', 'sp', 'tp'],
  staticVariables: ['lsm', 'z_sfc', 'slt'],
  ensemble1p5: {
    status: 'AURORA_1P5_ENSEMBLE_UNAVAILABLE',
    modelName: 'Microsoft Aurora 1.5 Ensemble Foundation Model',
    reason: 'Full Aurora 1.5 Ensemble requires higher-memory compute infrastructure than the current host.',
    hardwareRequirement: 'NVIDIA CUDA GPU with >= 24GB VRAM or >= 32GB RAM compute cluster',
  },
  smallResearch: {
    status: 'AURORA_SMALL_RESEARCH',
    modelName: 'Aurora 0.25° Small Pretrained — Research Mode',
    parameterCount: '112.8M',
    mode: 'OPTIONAL_RESEARCH_MODE',
  },
  hardwareRequirement: 'Host: RTX 4050 (6GB VRAM) / 16GB RAM — running Small Pretrained in Research Mode',
  cacheTtlHours: 6,
};

function getCacheFilePath(lat, lon) {
  const roundedLat = Number(lat).toFixed(2);
  const roundedLon = Number(lon).toFixed(2);
  return path.join(CACHE_DIR, `aurora_cache_${roundedLat}_${roundedLon}.json`);
}

function readCachedForecast(lat, lon) {
  try {
    const filePath = getCacheFilePath(lat, lon);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const timestamp = new Date(data.timestamp || 0).getTime();
    const ageMs = Date.now() - timestamp;

    if (ageMs < CACHE_TTL_MS) {
      return { ...data, cached: true, cacheAgeSeconds: Math.round(ageMs / 1000) };
    }
  } catch (err) {
    console.warn('Aurora cache read error:', err.message);
  }
  return null;
}

function writeCachedForecast(lat, lon, data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const filePath = getCacheFilePath(lat, lon);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Aurora cache write error:', err.message);
  }
}

/**
 * Queries the background Aurora 1.5 Ensemble worker.
 */
export async function queryAuroraForecast({ latitude, longitude, leadHours = 24, members = 4, forceRefresh = false }) {
  // 1. Check disk cache first to avoid unneeded process launches
  if (!forceRefresh) {
    const cached = readCachedForecast(latitude, longitude);
    if (cached) return cached;
  }

  // 2. Dispatch to Background Worker
  const venvWin = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
  const venvNix = path.join(process.cwd(), '.venv', 'bin', 'python');
  const pythonBin = process.env.PYTHON_BIN || (fs.existsSync(venvWin) ? venvWin : (fs.existsSync(venvNix) ? venvNix : 'python'));
  const workerScript = path.join(process.cwd(), 'ml', 'aurora', 'run_worker.py');

  return new Promise((resolve) => {
    let resolved = false;

    const fallbackStatus = (status, reason) => {
      if (resolved) return;
      resolved = true;
      const result = {
        enabled: false,
        status,
        modelName: AURORA_CONFIG.modelName,
        checkpoint: AURORA_CONFIG.checkpointId,
        targetLocation: { latitude: Number(latitude), longitude: Number(longitude) },
        ensembleMembers: members,
        reason: reason || 'Aurora 1.5 requires 3D atmospheric pressure tensor feeds and CUDA GPU clusters.',
        prerequisites: {
          pressureLevelsCount: AURORA_CONFIG.pressureLevelsHpa.length,
          surfaceVariablesCount: AURORA_CONFIG.surface2dVariables.length,
          hardware: AURORA_CONFIG.hardwareRequirement,
        },
        timestamp: new Date().toISOString(),
      };
      writeCachedForecast(latitude, longitude, result);
      resolve(result);
    };

    try {
      const child = spawn(
        pythonBin,
        ['-m', 'ml.aurora.run_worker', '--lat', String(latitude), '--lon', String(longitude), '--lead_hours', String(leadHours), '--members', String(members), '--json'],
        { cwd: process.cwd(), windowsHide: true }
      );

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        child.kill();
        fallbackStatus('UNAVAILABLE', 'Aurora worker execution timed out.');
      }, 8000);

      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });

      child.on('error', () => {
        clearTimeout(timeout);
        fallbackStatus('NOT_CONFIGURED', 'Python runtime or Aurora worker script is not configured.');
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout);
            if (parsed) {
              resolved = true;
              writeCachedForecast(latitude, longitude, parsed);
              return resolve(parsed);
            }
          } catch {}
        }
        fallbackStatus('NOT_CONFIGURED', stderr.trim() || 'Aurora worker returned unconfigured status.');
      });
    } catch {
      fallbackStatus('NOT_CONFIGURED', 'Failed to dispatch Aurora background worker.');
    }
  });
}

/**
 * Returns current status of Aurora service.
 */
export function getAuroraServiceInfo() {
  return {
    modelName: AURORA_CONFIG.modelName,
    checkpointId: AURORA_CONFIG.checkpointId,
    requiredLevels: AURORA_CONFIG.pressureLevelsHpa,
    requiredVariables: AURORA_CONFIG.atmospheric3dVariables,
    surfaceVariables: AURORA_CONFIG.surface2dVariables,
    hardwareRequirement: AURORA_CONFIG.hardwareRequirement,
    cachePolicy: `${AURORA_CONFIG.cacheTtlHours} hours disk cache`,
  };
}
