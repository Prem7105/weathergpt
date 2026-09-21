# Implementation status

Audit date: 2026-09-20. Status is based on source review and the verification commands recorded in `docs/TESTING.md`; a provider is never considered live without its required runtime configuration.

| Feature | Files | Status | Real/demo | Missing | Action |
|---|---|---|---|---|---|
| Weather, forecast and geocoding | `weatherApi.js`, `geocoding.js`, `useWeather.js` | WORKING | Open-Meteo live; Google optional | UI provider status is currently coarse | Configure Google only if enrichment is needed |
| Deterministic risk and impact | `riskEngine.js`, `/api/risk` | WORKING | Live weather input | None for base rules | Maintain threshold validation |
| Precipitation ML | `ml/`, `mlPrecipitation.js`, `/api/risk` | PARTIAL | Live only when Python model runtime works | Python dependencies are external | Install `ml/requirements.txt`; degraded status is returned otherwise |
| Ground reality | `Incident.js`, `incidentService.js`, `/api/incidents` | PARTIAL | MongoDB incidents real; seed incidents occur only in an explicit demo scenario | No official external feed adapter | Ingest authenticated official feeds through POST/admin workflow |
| Personas | `constants.js`, `riskEngine.js` | WORKING | Deterministic | None | Core test checks distinct actions |
| AI/RAG/grounding | `/api/chat`, `ragService.js`, `groundingGuard.js` | WORKING | Provider-dependent; deterministic fallback | Provider keys optional | Configure one or more AI providers |
| Auth and profile | `/api/auth/*`, `User.js` | PARTIAL | Real with MongoDB and auth secrets | No configured database in this checkout | Configure required auth environment |
| Push/cron | `/api/notifications/*`, cron route | PARTIAL | Real with VAPID + MongoDB | Provider configuration | Configure VAPID and CRON_SECRET |
| SMS | `smsService.js`, alerts API | PARTIAL | Twilio accepted or explicit non-delivery simulation | Twilio credentials | Configure Twilio sender |
| GSM modem and IVR/voice alerts | Removed files/routes/docs | REMOVED FROM SCOPE | Not available | N/A | Browser chat STT/TTS remains separate |
| Offline/PWA | `sw.js`, `offlineStorage.js` | PARTIAL | Cached browser data | No automated browser/offline test | Verify on supported browser/device |
| Map and comparison | `risk-map.jsx`, `CompareModal.jsx` | WORKING | Live weather/risk; incidents depend on DB | Spatial point is localized, not a regional coverage map | Do not imply unsupported precision |
| Android/Capacitor | `android/`, `capacitor.config.ts` | PARTIAL | Scaffold exists | Production sync/build unverified | Run Capacitor sync and Gradle build on Android toolchain |
