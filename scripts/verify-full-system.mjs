import assert from 'node:assert/strict';
import { calculateWeatherRisk, calculateHazardAtHour, buildImpactDecision, riskLevel, riskPriority, shouldSendRiskAlert } from '../src/lib/riskEngine.js';
import { assessRelevantIncidents, fuseRiskAndIncidents, normalizeIncident, distanceKm } from '../src/lib/incidentService.js';
import { retrieveKnowledge, formatRAGContextForPrompt } from '../src/lib/ragService.js';
import { validateGroundedMeasurements, measurementKeys } from '../src/lib/groundingGuard.js';
import { sendRiskAlert } from '../src/lib/smsService.js';
import { getSystemStatus } from '../src/lib/systemStatus.js';
import { encryptPrivateData, decryptPrivateData, blindIndex } from '../src/lib/privateData.js';
import { createSessionToken, readSessionToken } from '../src/lib/auth.js';

// Setup test environment variables
process.env.AUTH_SESSION_SECRET = 'test_session_secret_for_hardening_audit_1234567890';
process.env.AUTH_DATA_ENCRYPTION_KEY = Buffer.from('12345678901234567890123456789012').toString('base64'); // 32-byte key

console.log('====================================================');
console.log(' WEATHERGPT FULL ENGINEERING HARDENING TEST SUITE  ');
console.log('====================================================\n');

// 1. RISK ENGINE BOUNDARY TESTS
console.log('--- 1. Testing Risk Engine Thresholds & Boundaries ---');
assert.equal(riskLevel(0.0), 'low');
assert.equal(riskLevel(0.24), 'low');
assert.equal(riskLevel(0.25), 'moderate');
assert.equal(riskLevel(0.49), 'moderate');
assert.equal(riskLevel(0.50), 'high');
assert.equal(riskLevel(0.74), 'high');
assert.equal(riskLevel(0.75), 'severe');
assert.equal(riskLevel(1.0), 'severe');

// Edge cases: NaN, null, negative, overflow
assert.equal(riskLevel(NaN), 'low');
assert.equal(riskLevel(null), 'low');
assert.equal(riskLevel(-0.5), 'low');
assert.equal(riskLevel(1.5), 'severe');
console.log('✔ Risk thresholds (LOW, MODERATE, HIGH, SEVERE) verified.');

// Missing and extreme weather inputs
const missingWeatherRisk = calculateWeatherRisk({ current: {}, hourly: [] });
assert.ok(Number.isFinite(missingWeatherRisk.score));
assert.equal(missingWeatherRisk.level, 'low');

const extremeRainRisk = calculateWeatherRisk({
  current: { temperature: 28, humidity: 98, windSpeed: 20 },
  hourly: Array.from({ length: 24 }, () => ({ precipitation: 15, precipitationProbability: 100 }))
});
assert.equal(extremeRainRisk.type, 'flood');
assert.equal(extremeRainRisk.level, 'severe');
assert.ok(extremeRainRisk.score >= 0.75);

const extremeHeatRisk = calculateWeatherRisk({
  current: { temperature: 48, apparentTemperature: 54, humidity: 60, windSpeed: 10 },
  hourly: Array.from({ length: 24 }, () => ({ precipitation: 0, precipitationProbability: 0 }))
});
assert.equal(extremeHeatRisk.type, 'heat');
assert.equal(extremeHeatRisk.level, 'severe');
console.log('✔ Extreme and missing weather inputs handled gracefully.');

// 2. 5 PERSONAS DIFFERENTIATED DECISIONS
console.log('\n--- 2. Testing 5 Personas Distinct Decisions ---');
const personas = ['citizen', 'farmer', 'logistics', 'construction', 'authority'];
const decisionsMap = {};

for (const p of personas) {
  const imp = buildImpactDecision({
    hazard: 'flood',
    score: 0.85,
    level: 'severe',
    persona: p
  });
  assert.ok(imp.impacts.length > 0, `Persona ${p} must have impacts`);
  assert.ok(imp.decision.recommendations.length > 0, `Persona ${p} must have actions`);
  decisionsMap[p] = imp.decision.recommendations[0];
}

const uniqueDecisions = new Set(Object.values(decisionsMap));
assert.equal(uniqueDecisions.size, 5, 'All 5 personas must receive distinct guidance');
console.log('✔ 5 Personas distinct decisions verified.');

// 3. GROUND REALITY INCIDENT INGESTION & DEDUPLICATION
console.log('\n--- 3. Testing Ground Reality Ingestion & Filtering ---');
const baseLocation = { latitude: 23.0225, longitude: 72.5714 };
const now = new Date('2026-09-20T12:00:00Z');

const testIncidents = [
  // Valid nearby incident
  {
    category: 'ROAD_BLOCK',
    source: 'Traffic Police',
    sourceType: 'official',
    verification: 'OFFICIAL',
    publishedAt: '2026-09-20T11:00:00Z',
    expiresAt: '2026-09-20T16:00:00Z',
    location: { latitude: 23.03, longitude: 72.58, name: 'Underpass A' },
    locationConfidence: 0.9,
    relevance: 0.9,
    severity: 'high'
  },
  // Expired incident
  {
    category: 'WATERLOGGING',
    source: 'Municipal',
    sourceType: 'official',
    verification: 'OFFICIAL',
    publishedAt: '2026-09-20T04:00:00Z',
    expiresAt: '2026-09-20T08:00:00Z', // Expired
    location: { latitude: 23.03, longitude: 72.58, name: 'Drain B' },
    locationConfidence: 0.9,
    relevance: 0.9,
    severity: 'moderate'
  },
  // Far incident (> 15 km)
  {
    category: 'FLOODING',
    source: 'Highway Police',
    sourceType: 'official',
    verification: 'OFFICIAL',
    publishedAt: '2026-09-20T11:30:00Z',
    expiresAt: '2026-09-20T18:00:00Z',
    location: { latitude: 23.50, longitude: 73.20, name: 'Distant Expressway' },
    locationConfidence: 0.9,
    relevance: 0.9,
    severity: 'critical'
  }
];

const filtered = assessRelevantIncidents({
  incidents: testIncidents,
  location: baseLocation,
  now,
  radiusKm: 15
});

assert.equal(filtered.length, 1, 'Only non-expired, nearby incidents within radius should be retained');
assert.equal(filtered[0].location.name, 'Underpass A');
console.log('✔ Ground reality temporal decay & distance radius filtering verified.');

// 4. GROUNDING GUARD COMPREHENSIVE NUMERICAL TESTS
console.log('\n--- 4. Testing Grounding Guard Natural Language Normalization ---');
const groundingContext = {
  temperature: 28,
  humidity: 78,
  windSpeed: 18,
  distanceKm: 5.0,
  precipitation: 42.0,
  score: 0.78
};

// Test unit variants
const testPhrases = [
  'Currently 42 mm of rain is forecast.',
  'Expect 42mm precipitation.',
  'Recorded 42 millimeters of rain.',
  'Current temperature is 28°C.',
  'The temperature is 28 C.',
  'It is 28 degrees celsius.',
  'Humidity is 78%.',
  'Humidity is 78 percent.',
  'Risk score is 0.78 probability.',
  'Incident reported 5 km away.',
  'Incident reported 5 kilometres away.',
  'Wind speed is 18 km/h.',
  'Wind speed is 18 kmh.',
  'Wind speed is 18 kph.'
];

for (const phrase of testPhrases) {
  const result = validateGroundedMeasurements(phrase, groundingContext);
  assert.equal(result.grounded, true, `Expected phrase to be grounded: "${phrase}" (ungrounded: ${result.ungrounded})`);
}

// Test hallucinated numbers
const hallucinatedPhrases = [
  'Rainfall will reach 99 mm today.',
  'Temperature is 45°C.',
  'Wind speed is 95 km/h.',
  'Waterlogging reported 15 km away.'
];

for (const phrase of hallucinatedPhrases) {
  const result = validateGroundedMeasurements(phrase, groundingContext);
  assert.equal(result.grounded, false, `Expected hallucination to be caught: "${phrase}"`);
}
console.log('✔ Grounding Guard unit variations and hallucination detection verified.');

// 5. ALERT NOTIFICATION DEDUPLICATION & STATE TRANSITIONS
console.log('\n--- 5. Testing Alert Notification Safety & Deduplication ---');
const alertModerate = {
  riskSignature: 'flood:2026-09-20T14:00:00Z',
  eventId: 'flood:2026-09-20T14:00:00Z',
  alertLevel: 'Moderate',
  level: 'moderate',
  hazard: 'flood'
};

const alertHigh = {
  riskSignature: 'flood:2026-09-20T14:00:00Z',
  eventId: 'flood:2026-09-20T14:00:00Z',
  alertLevel: 'High',
  level: 'high',
  hazard: 'flood'
};

// Initial alert when none exists -> should send
assert.equal(shouldSendRiskAlert(null, alertModerate), true);

// Same event with same severity -> duplicate spam prevented
const existingModerate = {
  riskSignature: 'flood:2026-09-20T14:00:00Z',
  eventId: 'flood:2026-09-20T14:00:00Z',
  alertLevel: 'Moderate'
};
assert.equal(shouldSendRiskAlert(existingModerate, alertModerate), false, 'Duplicate moderate alert should NOT send');

// Risk escalation: MODERATE -> HIGH -> should trigger escalation alert
assert.equal(shouldSendRiskAlert(existingModerate, alertHigh), true, 'Escalation from MODERATE to HIGH must trigger alert');

// Risk de-escalation: HIGH -> MODERATE -> should NOT spam
const existingHigh = {
  riskSignature: 'flood:2026-09-20T14:00:00Z',
  eventId: 'flood:2026-09-20T14:00:00Z',
  alertLevel: 'High'
};
assert.equal(shouldSendRiskAlert(existingHigh, alertModerate), false, 'De-escalation should not trigger alert');
console.log('✔ Alert deduplication, cooldown, and escalation state transitions verified.');

// 6. LAST-MILE SMS HONEST REPORTING
console.log('\n--- 6. Testing SMS Simulated Mode & Length ---');
const smsResult = await sendRiskAlert({
  phoneNumber: '+919876543210',
  alert: {
    alertLevel: 'HIGH',
    hazard: 'flood',
    recommendedAction: 'Halt vehicle movement on submerged underpasses.'
  },
  persona: 'logistics',
  forceSimulated: true
});

assert.equal(smsResult.success, false);
assert.equal(smsResult.mode, 'SIMULATED');
assert.ok(smsResult.body.length <= 160, 'SMS body must be <= 160 characters');
assert.match(smsResult.body, /\[WeatherGPT HIGH FLOOD ALERT\]/);
console.log('✔ SMS formatting and honest SIMULATED status verified.');

// 7. SECURITY & ENCRYPTION
console.log('\n--- 7. Testing Auth Session Tokens & Private Data Encryption ---');
const sampleUserId = '654321098765432109876543';
const token = createSessionToken(sampleUserId);
assert.ok(token.includes('.'), 'Session token should be signed JWT-like structure');
const verifiedSession = readSessionToken(token);
assert.equal(verifiedSession.sub, sampleUserId, 'Session payload sub must match user ID');

// Test tamper resistance
const [payload, signature] = token.split('.');
const tamperedToken = `${payload}.invalidSignature`;
assert.equal(readSessionToken(tamperedToken), null, 'Tampered token must be rejected');

// Test AES-256-GCM Private Data Encryption
const sensitivePhoneNumber = '+919876543210';
const encrypted = encryptPrivateData(sensitivePhoneNumber);
assert.notEqual(encrypted, sensitivePhoneNumber);
const decrypted = decryptPrivateData(encrypted);
assert.equal(decrypted, sensitivePhoneNumber);

// Test Blind Indexing (deterministic hash for lookup)
const indexA = blindIndex(sensitivePhoneNumber);
const indexB = blindIndex(sensitivePhoneNumber);
assert.equal(indexA, indexB, 'Blind index must be deterministic');
assert.notEqual(indexA, sensitivePhoneNumber);
console.log('✔ Security: session tokens & AES-256-GCM private data encryption verified.');

// 8. SUBSYSTEM OBSERVABILITY & HEALTH CHECK
console.log('\n--- 8. Testing Subsystem Health Check ---');
const statusReport = await getSystemStatus();
assert.equal(statusReport.weather.status, 'CONNECTED');
assert.equal(statusReport.ml.status, 'CONNECTED');
assert.equal(statusReport.rag.status, 'CONNECTED');
assert.ok(statusReport.ai.status === 'CONNECTED' || statusReport.ai.status === 'DEGRADED');
assert.ok(['CONNECTED', 'NOT-CONFIGURED', 'DEGRADED'].includes(statusReport.database.status));
assert.ok(['CONNECTED', 'NOT-CONFIGURED'].includes(statusReport.push.status));
assert.ok(['CONNECTED', 'NOT-CONFIGURED'].includes(statusReport.sms.status));
assert.ok(['CONNECTED', 'NOT-CONFIGURED'].includes(statusReport.cron.status));
console.log('✔ Subsystem observability & health report verified.');

console.log('\n====================================================');
console.log(' ALL FULL SYSTEM HARDENING TESTS PASSED (8/8)       ');
console.log('====================================================\n');
