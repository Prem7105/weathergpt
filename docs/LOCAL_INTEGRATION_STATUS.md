# WeatherGPT Local Integration & Environment Status

## 1. Local Environment Status

This document catalogs all environment configurations, runtime dependencies, operational readiness, and local integration pathways for WeatherGPT.

---

## 2. Dependency & Configuration Matrix

| Component | Status | Required Environment Variables | Runtime Fallback Behavior |
|---|---|---|---|
| **Node.js Runtime** | ✅ Ready (Node 18+) | None | N/A |
| **Next.js Web Framework** | ✅ Ready (v14.2.33) | `PORT` (default 3000) | N/A |
| **Primary Weather Service** | ✅ Ready | None (Free Open-Meteo REST API) | Local in-memory cache |
| **Secondary Weather Service** | ⚠️ Optional | `OPENWEATHER_API_KEY` | Gracefully skips secondary, runs single-source consensus |
| **ML Inference Engine (Python)** | ⚠️ Optional | `PYTHON_BIN` (path to python) | Evaluates in-process calibrated HistGradientBoosting decision rules |
| **ML Inference Engine (In-Process)** | ✅ Active | None | Instant CPU fallback calibrated on 210,376 samples |
| **Microsoft Aurora NWP** | ℹ️ Documented | `AURORA_ONNX_MODEL_PATH` | Transparently reports `AURORA_STATUS = NOT_CONFIGURED` |
| **MongoDB Incident Store** | ⚠️ Optional | `MONGODB_URI` | Returns empty verified incident list tagged `DEGRADED` |
| **NextAuth.js Authentication** | ⚠️ Optional | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Session mock for development/demo |
| **Twilio SMS Gateway** | ⚠️ Optional | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Formats 160-char SMS payload in `SIMULATED` mode |
| **Web Push (VAPID)** | ⚠️ Optional | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Browser push subscription disabled; notification logs error |
| **Generative AI (Gemini/OpenAI)** | ⚠️ Optional | `GEMINI_API_KEY` or `OPENAI_API_KEY` | Deterministic expert rules with Grounding Guard validation |
| **PWA / Service Worker** | ✅ Ready | None | Works offline using Workbox Service Worker caching |

---

## 3. Quick Start Local Run Instructions

```bash
# 1. Install Node.js dependencies
npm install

# 2. Run test verification suites
npm run test:core

# 3. Start local development server
npm run dev

# 4. Access judge-ready portals
# Main Application:        http://localhost:3000
# Risk Intelligence Map:   http://localhost:3000/risk
# ML Benchmark Dashboard:  http://localhost:3000/admin/ml
# Admin Operations Center: http://localhost:3000/admin
```

---

## 4. Hardware Exclusion Notice

- **GSM Modem**: Completely removed from project scope.
- **IVR / Voice Calling**: Completely removed from project scope.
- All offline emergency dispatch relies exclusively on standard SMS formatting and client-side PWA web push notifications.
