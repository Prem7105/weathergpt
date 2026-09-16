import { spawn } from 'node:child_process';
import path from 'node:path';

export function predictNextHourPrecipitation({ current, hourly, timestamp }) {
  return new Promise((resolve) => {
    const script = path.join(process.cwd(), 'ml', 'inference', 'predict_precipitation.py');
    const child = spawn(process.env.PYTHON_BIN || 'python', [script], { cwd: process.cwd(), windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', () => resolve({ enabled: false, reason: 'ML inference runtime unavailable.' }));
    child.on('close', (code) => {
      if (code !== 0) return resolve({ enabled: false, reason: stderr.trim() || 'ML inference failed.' });
      try { resolve(JSON.parse(stdout)); } catch { resolve({ enabled: false, reason: 'ML inference returned invalid output.' }); }
    });
    const selected = hourly.find((hour) => hour.time === timestamp) || hourly[hourly.length - 1] || {};
    const selectedDate = timestamp ? new Date(timestamp) : new Date();
    child.stdin.end(JSON.stringify({ current: selected, history: hourly.filter((hour) => new Date(hour.time) < selectedDate).slice(-12), timestamp, hour: selectedDate.getUTCHours(), dayOfYear: Math.floor((selectedDate - new Date(Date.UTC(selectedDate.getUTCFullYear(), 0, 0))) / 86400000) }));
  });
}
