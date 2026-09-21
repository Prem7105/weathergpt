# Testing Strategy & Verification Guide

WeatherGPT includes automated deterministic tests, numerical grounding tests, and end-to-end subsystem verification.

---

## 1. Test Commands

```powershell
# 1. Run full core verification suite (Risk, 5 Personas, ML, Incidents, RAG, Grounding, Alerts, Security)
npm run test:core

# 2. Run static code analysis and ESLint rules
npm run lint

# 3. Run production Next.js compilation & static page generation
npm run build
```

---

## 2. Test Matrix

| Test Suite | File | What It Verifies |
|---|---|---|
| **Core Risk Engine** | `scripts/verify-core.mjs` | Multi-hazard score calculation, 24-hr rainfall summation, risk level assignment |
| **5 Personas Differentiation** | `scripts/verify-core.mjs` | Verifies all 5 personas (Citizen, Farmer, Logistics, Construction, Authority) receive distinct decisions for identical severe weather |
| **Ground Reality Incident Fusion** | `scripts/verify-core.mjs` | Incident spatial filtering, temporal decay, situational severity adaptation |
| **Authoritative RAG Retrieval** | `scripts/verify-core.mjs` | In-memory NDMA, IMD, ICAR guidelines retrieval and prompt formatting |
| **Grounding Guard** | `scripts/verify-core.mjs`, `scripts/verify-full-system.mjs` | Validates measurements with natural language units (e.g. `42 mm`, `42 millimeters`, `28°C`, `28 degrees`, `78%`, `0.78`, `5 km`, `18 km/h`) and catches ungrounded numbers |
| **ML-Assisted Flood Rules** | `scripts/verify-core.mjs` | Verifies ML precipitation prediction connects to deterministic flood score without overriding safety rules |
| **SMS Last-Mile Formatting** | `scripts/verify-core.mjs` | Validates single-segment <=160 char SMS formatting and honest `SIMULATED` status |
| **Risk Thresholds & Boundaries** | `scripts/verify-full-system.mjs` | Boundary tests at exact thresholds (0.00, 0.24, 0.25, 0.49, 0.50, 0.74, 0.75, 1.00), NaN/null/negative inputs |
| **Notification Safety & Deduplication** | `scripts/verify-full-system.mjs` | Tests alert deduplication, cooldown, escalation (MODERATE -> HIGH), and de-escalation suppression |
| **Security & Cryptography** | `scripts/verify-full-system.mjs` | Verifies HMAC-signed session tokens, token tampering rejection, AES-256-GCM PII encryption, and blind indexing |
| **Subsystem Health & Observability** | `scripts/verify-full-system.mjs` | Verifies `getSystemStatus()` reports honest status for all 8 subsystems |

---

## 3. Failure Injection Testing

- **Weather API Unavailable:** System gracefully loads offline cached state with clear `OFFLINE-CACHED` badge.
- **ML Runtime Unavailable:** Risk engine falls back to deterministic forecast-only rules with `DEGRADED` ML status.
- **MongoDB Unavailable:** Ground reality returns `status: "unavailable"` without throwing or crashing the page.
- **AI Keys Not Configured:** Chat route dispatches to local deterministic reasoning engine.
- **Twilio SMS Not Configured:** SMS API returns `{ success: false, mode: "NOT-CONFIGURED" }` without pretending to deliver.
