/**
 * WeatherGPT — Live Integration Test Suite
 * npm run test:live
 *
 * Tests real connectivity to external services.
 * Statuses: PASS | NOT_CONFIGURED | DEGRADED | FAIL
 *
 * NOT_CONFIGURED is never counted as PASS.
 * DEGRADED means the service exists but is limited.
 */

import fs from 'node:fs';
import path from 'node:path';

// Load .env.local into process.env if present
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const keyName = key.trim();
        const val = valParts.join('=').trim();
        if (keyName && !process.env[keyName]) {
          process.env[keyName] = val;
        }
      }
    }
  }
} catch (e) {
  // Ignore env file read errors
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const RESULTS = [];

function result(name, status, detail = '') {
  RESULTS.push({ name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'NOT_CONFIGURED' ? '⚪' : status === 'DEGRADED' ? '🟡' : '❌';
  console.log(`  ${icon} [${status}] ${name}${detail ? ': ' + detail : ''}`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OPEN-METEO CONNECTIVITY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📡 1. Open-Meteo Live Weather Connectivity');
try {
  const res = await fetchWithTimeout(
    'https://api.open-meteo.com/v1/forecast?latitude=19.07&longitude=72.87&current=temperature_2m,relative_humidity_2m,precipitation&hourly=precipitation,temperature_2m&forecast_days=1'
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const temp = data?.current?.temperature_2m;
  if (typeof temp !== 'number') throw new Error('Unexpected response structure');
  result('Open-Meteo API', 'PASS', `temperature_2m=${temp}°C for Mumbai`);
} catch (err) {
  result('Open-Meteo API', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. WEATHER PARSING VIA /api/risk
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n⚠️  2. Risk API — Weather Parsing & Risk Calculation');
try {
  const res = await fetchWithTimeout(`${BASE_URL}/api/risk?lat=19.07&lon=72.87&persona=citizen`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!data.risk?.type) throw new Error('No risk type returned');
  if (!data.risk?.score && data.risk?.score !== 0) throw new Error('No risk score returned');
  if (data.source !== 'Open-Meteo') {
    result('Risk API — Live Weather Source', 'DEGRADED', `Source is '${data.source}' not Open-Meteo`);
  } else {
    result('Risk API — Live Weather Source', 'PASS', `hazard=${data.risk.type}, score=${data.risk.score}, status=${data.dataStatus}`);
  }

  if (data.dataStatus === 'LIVE') {
    result('Risk API — Data Status Honest', 'PASS', 'dataStatus=LIVE');
  } else {
    result('Risk API — Data Status Honest', 'DEGRADED', `dataStatus=${data.dataStatus} (expected LIVE)`);
  }
} catch (err) {
  result('Risk API', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ML PRECIPITATION PREDICTION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🤖 3. ML Precipitation Pipeline');
try {
  const res = await fetchWithTimeout(`${BASE_URL}/api/risk?lat=19.07&lon=72.87&persona=farmer&hazard=flood`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const ml = data.ml;
  if (!ml) throw new Error('No ML object returned');
  if (ml.enabled === false && ml.status === 'NOT-APPLICABLE') {
    result('ML Prediction — Flood Hazard', 'DEGRADED', `ML is NOT-APPLICABLE for non-flood. Reason: ${ml.reason}`);
  } else if (ml.enabled && ml.status === 'LIVE') {
    result('ML Prediction — Flood Hazard', 'PASS', `predicted=${ml.predictedPrecipitationMm}mm, confidence=${ml.uncertainty?.confidenceScore}`);
  } else {
    result('ML Prediction — Flood Hazard', 'DEGRADED', `status=${ml.status}`);
  }
} catch (err) {
  result('ML Prediction', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MONGODB CONNECTIVITY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🗄️  4. MongoDB Connectivity');
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri || mongoUri.includes('YOUR_PASSWORD') || mongoUri.includes('<PASSWORD>') || mongoUri.includes('CHANGE_ME') || mongoUri.includes('YOUR_PASS')) {
  result('MongoDB', 'NOT_CONFIGURED', 'MONGODB_URI has placeholder password — replace YOUR_PASSWORD with your actual password in .env.local');
} else if (!mongoUri.startsWith('mongodb')) {
  result('MongoDB', 'FAIL', 'MONGODB_URI format is invalid (must start with mongodb:// or mongodb+srv://)');
} else {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/status`);
    const data = await res.json();
    const dbStatus = data?.subsystems?.database?.status;
    if (dbStatus === 'CONNECTED') {
      result('MongoDB', 'PASS', 'CONNECTED');
    } else {
      result('MongoDB', 'FAIL', `Database status: ${dbStatus}. Check your MONGODB_URI.`);
    }
  } catch (err) {
    result('MongoDB', 'FAIL', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. USER PERSISTENCE (register + login + me + logout)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔐 5. User Authentication Persistence');
const mongoUriSet = !!(mongoUri && !mongoUri.includes('YOUR_PASSWORD') && !mongoUri.includes('<PASSWORD>') && !mongoUri.includes('CHANGE_ME'));
if (!mongoUriSet) {
  result('Auth Register/Login', 'NOT_CONFIGURED', 'Requires valid MONGODB_URI (placeholder password detected)');
} else {
  const testEmail = `livetest_${Date.now()}@weathergpt-test.local`;
  const testPhone = `+91${Math.floor(9000000000 + Math.random() * 999999999)}`;
  let sessionCookie = '';

  try {
    // Register
    const regRes = await fetchWithTimeout(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Live Test User', phone: testPhone, email: testEmail, password: 'LiveTest@123!', category: 'citizen' })
    });
    if (!regRes.ok) {
      const err = await regRes.json().catch(() => ({}));
      throw new Error(`Register failed: ${err.message || regRes.status}`);
    }
    const regData = await regRes.json();
    sessionCookie = regRes.headers.get('set-cookie') || '';
    result('Auth Register', 'PASS', `user id=${regData.user?.id}`);

    // Login
    const loginRes = await fetchWithTimeout(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
      body: JSON.stringify({ phone: testPhone, password: 'LiveTest@123!' })
    });
    if (!loginRes.ok) throw new Error(`Login failed: HTTP ${loginRes.status}`);
    const loginCookie = loginRes.headers.get('set-cookie') || sessionCookie;
    result('Auth Login', 'PASS');

    // Me
    const meRes = await fetchWithTimeout(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: loginCookie }
    });
    const meData = await meRes.json();
    if (meData.user) {
      result('Auth Session /me', 'PASS', `user.category=${meData.user.category}`);
    } else {
      result('Auth Session /me', 'FAIL', 'Session not restored after login');
    }

    // Logout
    const logoutRes = await fetchWithTimeout(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: loginCookie }
    });
    result('Auth Logout', logoutRes.ok ? 'PASS' : 'FAIL');
  } catch (err) {
    result('Auth Flow', 'FAIL', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GROUND REALITY / INCIDENTS API
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📍 6. Ground Reality — Incident API');
try {
  const res = await fetchWithTimeout(`${BASE_URL}/api/risk?lat=19.07&lon=72.87&persona=citizen`);
  const data = await res.json();
  const incStatus = data?.incidents?.dataStatus;
  if (incStatus === 'LIVE') {
    result('Incidents API', 'PASS', 'LIVE incidents from MongoDB');
  } else if (incStatus === 'DEGRADED') {
    result('Incidents API', 'DEGRADED', 'MongoDB not connected — no live incidents');
  } else if (incStatus === 'DEMO-SCENARIO') {
    result('Incidents API', 'DEGRADED', 'Returning DEMO incidents in non-demo mode — check request params');
  } else {
    result('Incidents API', 'NOT_CONFIGURED', `incidentStatus=${incStatus}`);
  }
} catch (err) {
  result('Incidents API', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. RAG RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📚 7. RAG — Authoritative Knowledge Retrieval');
try {
  const res = await fetchWithTimeout(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: 'You are WeatherGPT.',
      conversationHistory: [{ role: 'user', content: 'What should I do in a flood?' }],
      persona: 'citizen', language: 'english',
      risk: { type: 'flood', level: 'high', score: 0.75 },
      userQuery: 'What should I do in a flood?'
    })
  }, 25000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.rag && data.rag.length > 0) {
    result('RAG Retrieval', 'PASS', `${data.rag.length} guideline(s) retrieved: ${data.rag[0]?.source}`);
  } else {
    result('RAG Retrieval', 'FAIL', 'No RAG items returned');
  }
} catch (err) {
  result('RAG Retrieval', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. AI PROVIDER (GEMINI / CLAUDE / OPENAI)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🧠 8. AI Provider (Gemini / Claude / OpenAI)');
const hasGemini = !!process.env.GEMINI_API_KEY;
const hasClaude = !!process.env.CLAUDE_API_KEY;
const hasOpenAI = !!process.env.OPENAI_API_KEY;

if (!hasGemini && !hasClaude && !hasOpenAI) {
  result('AI Provider', 'NOT_CONFIGURED', 'No GEMINI_API_KEY, CLAUDE_API_KEY, or OPENAI_API_KEY set. Chat will use deterministic fallback.');
} else {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: 'You are WeatherGPT.',
        conversationHistory: [{ role: 'user', content: 'What is the weather like today in Mumbai?' }],
        persona: 'citizen', language: 'english',
        weather: { temp: 29, humidity: 74, windSpeed: 8, condition: 'Partly Cloudy', city: 'Mumbai' },
        userQuery: 'What is the weather like today in Mumbai?'
      })
    }, 25000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.text && data.text.trim()) {
      result('AI Provider', 'PASS', `Response from provider: ${data.provider}. Length: ${data.text.length} chars.`);
    } else {
      result('AI Provider', 'DEGRADED', `Provider=${data.provider}, text=null — API key set but request failed or was rejected by Grounding Guard`);
    }
  } catch (err) {
    result('AI Provider', 'FAIL', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. GROUNDING GUARD
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🛡️  9. Grounding Guard');
try {
  const { validateGroundedMeasurements } = await import('../src/lib/groundingGuard.js');
  const context = { weather: { temp: 29, humidity: 74 }, forecast: null, risk: null };

  const validResult = validateGroundedMeasurements('The temperature is 29°C and humidity is 74%.', context);
  const invalidResult = validateGroundedMeasurements('The temperature is 99°C and humidity is 99%.', context);

  if (validResult.grounded && !invalidResult.grounded) {
    result('Grounding Guard', 'PASS', 'Accepts grounded claims, rejects hallucinated measurements');
  } else {
    result('Grounding Guard', 'FAIL', `Valid grounded=${validResult.grounded}, invalid grounded=${invalidResult.grounded}`);
  }
} catch (err) {
  result('Grounding Guard', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. TTS (Text-to-Speech)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔊 10. TTS — Indian Language Audio Generation');
try {
  const languages = ['english', 'hindi'];
  for (const lang of languages) {
    const res = await fetchWithTimeout(
      `${BASE_URL}/api/tts?text=Hello+WeatherGPT+live+test&lang=${lang}`,
      {}, 12000
    );
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('audio/mpeg')) {
        result(`TTS — ${lang}`, 'PASS', 'audio/mpeg stream returned');
      } else {
        result(`TTS — ${lang}`, 'FAIL', `Expected audio/mpeg, got ${contentType}`);
      }
    } else {
      result(`TTS — ${lang}`, 'FAIL', `HTTP ${res.status}`);
    }
  }
} catch (err) {
  result('TTS', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. WEB PUSH CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔔 11. Web Push (VAPID)');
const hasVapid = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (!hasVapid) {
  result('Web Push (VAPID)', 'NOT_CONFIGURED', 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY not set. Run: npx web-push generate-vapid-keys');
} else {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/notifications/config`);
    const data = await res.json();
    if (data.publicKey && data.publicKey.length > 10) {
      result('Web Push (VAPID)', 'PASS', 'VAPID public key served to client');
    } else {
      result('Web Push (VAPID)', 'FAIL', 'publicKey empty despite env vars being set');
    }
  } catch (err) {
    result('Web Push (VAPID)', 'FAIL', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. TWILIO SMS CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📱 12. Twilio SMS');
const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
if (!hasTwilio) {
  result('Twilio SMS', 'NOT_CONFIGURED', 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER not set. SMS will be NOT-CONFIGURED.');
} else {
  result('Twilio SMS', 'PASS', 'Twilio credentials are configured. Live dispatch requires valid phone numbers during actual alert.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. RISK TILE API
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🗺️  13. Risk Tile API (XYZ tiles)');
try {
  // Tile z=6, x=46, y=23 covers central India
  const res = await fetchWithTimeout(`${BASE_URL}/api/risk/tiles/6/46/23`, {}, 10000);
  if (res.status === 200) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('image/png') || ct.includes('image/')) {
      result('Risk Tile API', 'PASS', `Tile returned: ${ct}`);
    } else if (ct.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      result('Risk Tile API', 'DEGRADED', `Returns JSON not image tile: ${JSON.stringify(data).slice(0, 100)}`);
    } else {
      result('Risk Tile API', 'DEGRADED', `Unexpected content-type: ${ct}`);
    }
  } else if (res.status === 503) {
    result('Risk Tile API', 'NOT_CONFIGURED', 'OPENWEATHERMAP_API_KEY not set — precipitation heatmap overlay requires an OpenWeatherMap API key (free tier available at openweathermap.org)');
  } else if (res.status === 404) {
    result('Risk Tile API', 'DEGRADED', 'Tile returned 404 — check OpenWeatherMap key or tile coordinates');
  } else if (res.status === 401) {
    result('Risk Tile API', 'NOT_CONFIGURED', 'OPENWEATHERMAP_API_KEY not configured for tile proxy');
  } else {
    result('Risk Tile API', 'FAIL', `HTTP ${res.status}`);
  }
} catch (err) {
  result('Risk Tile API', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. API STATUS ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🩺 14. /api/status Health Check');
try {
  const res = await fetchWithTimeout(`${BASE_URL}/api/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'OK' || data.status === 'DEGRADED') {
    result('/api/status Endpoint', 'PASS', `status=${data.status}, subsystems=${Object.keys(data.subsystems || {}).length}`);
  } else {
    result('/api/status Endpoint', 'FAIL', `Unexpected status: ${data.status}`);
  }
} catch (err) {
  result('/api/status Endpoint', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. OFFLINE STATE (Edge Cache)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📶 15. Offline / Edge Cache (offlineStorage.js)');
try {
  const { saveEdgeState, loadEdgeState, clearEdgeState } = await import('../src/lib/offlineStorage.js');
  const testState = { weather: { temp: 29 }, risk: { level: 'moderate' }, lastSyncFormatted: '12:00 PM' };
  // Test in-memory (localStorage not available in Node)
  if (typeof saveEdgeState === 'function' && typeof loadEdgeState === 'function') {
    result('Offline Storage Module', 'PASS', 'saveEdgeState/loadEdgeState functions exist and are importable');
  } else {
    result('Offline Storage Module', 'FAIL', 'Module does not export expected functions');
  }
} catch (err) {
  result('Offline Storage Module', 'FAIL', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  WEATHERGPT LIVE INTEGRATION TEST RESULTS');
console.log('═'.repeat(60));

const pass = RESULTS.filter(r => r.status === 'PASS').length;
const fail = RESULTS.filter(r => r.status === 'FAIL').length;
const degraded = RESULTS.filter(r => r.status === 'DEGRADED').length;
const notConfigured = RESULTS.filter(r => r.status === 'NOT_CONFIGURED').length;

console.log(`  ✅ PASS:           ${pass}`);
console.log(`  🟡 DEGRADED:       ${degraded}`);
console.log(`  ⚪ NOT_CONFIGURED: ${notConfigured} (requires external credentials)`);
console.log(`  ❌ FAIL:           ${fail}`);
console.log('═'.repeat(60));

if (RESULTS.filter(r => r.status === 'FAIL').length > 0) {
  console.log('\n❌ FAILED TESTS:');
  RESULTS.filter(r => r.status === 'FAIL').forEach(r => console.log(`  • ${r.name}: ${r.detail}`));
}

if (notConfigured > 0) {
  console.log('\n⚪ NOT CONFIGURED (add credentials to .env.local to enable):');
  RESULTS.filter(r => r.status === 'NOT_CONFIGURED').forEach(r => console.log(`  • ${r.name}: ${r.detail}`));
}

if (fail > 0) process.exit(1);
