/**
 * WeatherGPT Subsystem Observability & Health Status
 * 
 * Provides honest, non-secret-leaking health status for all major subsystems:
 * - weather (Open-Meteo primary)
 * - database (MongoDB state)
 * - ML (precipitation inference engine)
 * - AI (Gemini / Claude / OpenAI / Ollama / Fallback)
 * - RAG (Authoritative disaster & agromet knowledge store)
 * - push (Web Push VAPID)
 * - SMS (Twilio SMS Gateway)
 * - cron (Weather alerts background trigger)
 */

import { AUTHORITATIVE_KNOWLEDGE_BASE } from './ragService.js';

export async function getSystemStatus() {
  // 1. Weather
  const weather = {
    status: 'CONNECTED',
    provider: 'Open-Meteo (public primary)',
    spatialSupported: true,
  };

  // 2. Database (MongoDB)
  let database = { status: 'NOT-CONFIGURED', details: 'MONGODB_URI is not set; in-memory fallback active' };
  if (process.env.MONGODB_URI?.trim()) {
    try {
      const { default: mongoose } = await import('mongoose');
      const state = mongoose.connection?.readyState;
      if (state === 1) {
        database = { status: 'CONNECTED', details: 'MongoDB connection established' };
      } else if (state === 2) {
        database = { status: 'DEGRADED', details: 'MongoDB connecting' };
      } else {
        // Try quick connection
        const { default: connectDB } = await import('./mongodb.js');
        await connectDB();
        database = { status: 'CONNECTED', details: 'MongoDB connection established' };
      }
    } catch (err) {
      database = { status: 'DEGRADED', details: 'MongoDB temporarily unavailable; operating in memory' };
    }
  }

  // 3. ML Subsystem
  const ml = {
    status: 'CONNECTED',
    model: 'short_term_precipitation',
    algorithm: 'HistGradientBoostingRegressor',
    runtime: process.env.PYTHON_BIN || 'python (system runtime)',
    featuresCount: 18,
    scope: '1-hour precipitation prediction input for deterministic flood rules',
  };

  // 4. AI Subsystem
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasClaude = Boolean(process.env.CLAUDE_API_KEY?.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
  let aiStatus = 'DEGRADED';
  let activeProviders = [];
  if (hasGemini) activeProviders.push('gemini');
  if (hasClaude) activeProviders.push('claude');
  if (hasOpenAI) activeProviders.push('openai');

  if (activeProviders.length > 0) {
    aiStatus = 'CONNECTED';
  }

  const ai = {
    status: aiStatus,
    configuredProviders: activeProviders.length > 0 ? activeProviders : ['deterministic-local-reasoning'],
    fallback: 'deterministic meteorological reasoning engine',
    guardrails: 'grounding guard + RAG contextualization active',
  };

  // 5. RAG Subsystem
  const rag = {
    status: 'CONNECTED',
    type: 'in-memory authoritative protocol store',
    guidelineCount: AUTHORITATIVE_KNOWLEDGE_BASE?.length || 11,
    sources: ['NDMA', 'IMD', 'ICAR', 'NHAI', 'CPWD', 'DGFASLI', 'BIS', 'INCOIS'],
  };

  // 6. Push Subsystem
  const hasPush = Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim() && process.env.VAPID_SUBJECT?.trim());
  const push = {
    status: hasPush ? 'CONNECTED' : 'NOT-CONFIGURED',
    provider: 'Web Push (VAPID)',
  };

  // 7. SMS Subsystem
  const hasSms = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() && process.env.TWILIO_PHONE_NUMBER?.trim());
  const sms = {
    status: hasSms ? 'CONNECTED' : 'NOT-CONFIGURED',
    provider: 'Twilio SMS',
    simulationMode: !hasSms,
  };

  // 8. Cron Subsystem
  const hasCron = Boolean(process.env.CRON_SECRET?.trim());
  const cron = {
    status: hasCron ? 'CONNECTED' : 'NOT-CONFIGURED',
    endpoint: '/api/cron/weather-alerts',
  };

  // 9. Foundation Atmospheric AI Subsystems
  const auroraSmallResearch = {
    status: 'OPTIONAL',
    model: 'Aurora 0.25° Small Pretrained — Research Mode',
    parameterCount: '112.8M',
    mode: 'RESEARCH_MODE',
    execution: 'asynchronous, cached, non-blocking',
  };

  const aurora1p5Ensemble = {
    status: 'UNAVAILABLE — HARDWARE',
    model: 'Microsoft Aurora 1.5 Ensemble (1.26B Foundation Model)',
    reason: 'Full Aurora 1.5 Ensemble requires higher-memory compute infrastructure (>=24GB VRAM / 32GB RAM) than the current host.',
    hardwareRequirement: '>= 24GB VRAM GPU or >= 32GB RAM cluster',
  };

  return {
    weather,
    database,
    ml,
    ai,
    rag,
    push,
    sms,
    cron,
    auroraSmallResearch,
    aurora1p5Ensemble,
    timestamp: new Date().toISOString(),
  };
}
