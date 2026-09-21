import assert from 'node:assert/strict';
import { calculateWeatherRisk, calculateHazardAtHour, buildImpactDecision } from '../src/lib/riskEngine.js';
import { assessRelevantIncidents, fuseRiskAndIncidents } from '../src/lib/incidentService.js';
import { retrieveKnowledge, formatRAGContextForPrompt } from '../src/lib/ragService.js';
import { validateGroundedMeasurements } from '../src/lib/groundingGuard.js';
import { sendRiskAlert } from '../src/lib/smsService.js';

console.log('--- 1. Testing Core Risk Calculation ---');
const risk = calculateWeatherRisk({
  current: { temperature: 28, humidity: 90, windSpeed: 14 },
  hourly: [
    { time: '2026-09-16T20:00:00Z', precipitation: 20, precipitationProbability: 95 },
    { time: '2026-09-16T21:00:00Z', precipitation: 25, precipitationProbability: 95 },
    { time: '2026-09-16T22:00:00Z', precipitation: 15, precipitationProbability: 90 },
  ]
});
assert.equal(risk.type, 'flood');
assert.ok(risk.score > 0.5, 'Expected high risk score for heavy rain (>50mm total)');
console.log('✔ Core risk calculation passed with score:', risk.score);

console.log('--- 2. Testing 5 Personas Differentiated Decisions & Impacts ---');
const personas = ['citizen', 'farmer', 'logistics', 'construction', 'authority'];
const personaDecisions = {};

for (const persona of personas) {
  const result = buildImpactDecision({
    hazard: 'flood',
    score: 0.82,
    level: 'severe',
    persona,
    weatherContext: { current: { temperature: 28, windSpeed: 14 }, hourly: [{ precipitation: 15 }] }
  });

  assert.ok(result.impacts.length > 0, `Persona ${persona} should have deterministic physical impacts`);
  assert.ok(result.decision.recommendations.length > 0, `Persona ${persona} must have recommendations`);
  const primaryAction = result.decision.recommendations[0];
  assert.ok(primaryAction, `Persona ${persona} must have primary recommendation`);
  personaDecisions[persona] = primaryAction;
}

// Ensure all 5 personas have unique primary actions for the same event
const uniqueActions = new Set(Object.values(personaDecisions));
assert.equal(uniqueActions.size, 5, 'All 5 personas must receive distinct, persona-tailored action guidance');
console.log('✔ 5 Personas differentiated decisions verified:', personaDecisions);

console.log('--- 3. Testing Incident Fusion ---');
const incidents = assessRelevantIncidents({
  location: { latitude: 23.0225, longitude: 72.5714 },
  now: new Date('2026-09-16T20:00:00Z'),
  incidents: [{
    category: 'ROAD_BLOCK',
    source: 'Ahmedabad Traffic Police Feed',
    sourceType: 'official',
    verification: 'CORROBORATED',
    publishedAt: '2026-09-16T19:30:00Z',
    location: { latitude: 23.04, longitude: 72.58, name: 'Subhash Bridge Underpass' },
    locationConfidence: 0.9,
    relevance: 0.9,
    severity: 'high'
  }]
});
assert.equal(incidents.length, 1);
const fused = fuseRiskAndIncidents({ risk, incidents, persona: 'logistics' });
assert.match(fused.advisory.action, /Reroute|Avoid/i);
console.log('✔ Incident assessment & fusion passed.');

console.log('--- 4. Testing RAG Retrieval of Authoritative Guidelines ---');
const citizenRAG = retrieveKnowledge({ hazard: 'flood', severity: 'severe', persona: 'citizen', query: 'underpass water commute' });
assert.ok(citizenRAG.length > 0, 'RAG should return NDMA guideline for flood citizen');
assert.match(citizenRAG[0].guidance, /underpass|flood waters/i);

const farmerRAG = retrieveKnowledge({ hazard: 'flood', severity: 'high', persona: 'farmer', query: 'standing crop drainage' });
assert.ok(farmerRAG.length > 0, 'RAG should return ICAR guideline for flood farmer');
assert.match(farmerRAG[0].guidance, /drain|crop/i);

const formattedRAG = formatRAGContextForPrompt(citizenRAG);
assert.match(formattedRAG, /NDMA/);
console.log('✔ RAG authoritative retrieval passed.');

console.log('--- 5. Testing Grounding Guard ---');
const groundedContext = {
  temperature: 28,
  humidity: 90,
  windSpeed: 14,
  distanceKm: 2.5
};

const validText = 'Currently it is 28°C with 90% humidity and 14 km/h wind. Incident is 2.5 km away.';
const validCheck = validateGroundedMeasurements(validText, groundedContext);
assert.equal(validCheck.grounded, true, 'Valid measurements in text should be grounded');

const hallucinatedText = 'Currently it is 38°C with 40% humidity.';
const hallucinatedCheck = validateGroundedMeasurements(hallucinatedText, groundedContext);
assert.equal(hallucinatedCheck.grounded, false, 'Hallucinated 38°C should fail grounding guard');
assert.ok(hallucinatedCheck.ungrounded.includes('38.0:c'), 'Ungrounded list should contain 38.0:c');
console.log('✔ Grounding Guard verification passed.');

console.log('--- 6. Testing ML-Assisted Flood Rule Boundaries ---');
const ruleOnlyFlood = calculateHazardAtHour({ current: { humidity: 80 }, hour: { precipitation: 4, precipitationProbability: 70, time: '2026-09-16T20:00:00Z' }, hazard: 'flood' });
const modelAssistedFlood = calculateHazardAtHour({ current: { humidity: 80 }, hour: { precipitation: 4, precipitationProbability: 70, time: '2026-09-16T20:00:00Z' }, hazard: 'flood', mlPredictionMm: 10 });
assert.ok(modelAssistedFlood.score > ruleOnlyFlood.score, 'Live ML precipitation input must affect only the flood rule score.');
assert.match(modelAssistedFlood.method, /ML precipitation prediction plus deterministic risk rules/);
assert.ok(modelAssistedFlood.factors.some((factor) => factor.label === 'ML next-hour precipitation'));
console.log('✔ ML precipitation is connected to deterministic flood rules.');

console.log('--- 7. Testing Last-Mile SMS Alert Formatting (Simulated Mode) ---');
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
assert.match(smsResult.body, /\[WeatherGPT HIGH FLOOD ALERT\]/);
assert.ok(smsResult.body.length <= 160, 'SMS body must fit single 160-char SMS segment');
assert.match(smsResult.note, /No SMS was sent/);
console.log('✔ SMS formatting and honest simulated non-delivery verified.');

console.log('\n=============================================');
console.log(' ALL CORE PIPELINE TESTS PASSED SUCCESSFULLY! ');
console.log('=============================================\n');
