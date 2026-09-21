# WeatherGPT Real vs Demo / Simulated Matrix

This document provides a strict, honest audit of all subsystem behaviors, data sources, degradation paths, and demo indicators across WeatherGPT.

---

## Complete Feature Operational Status Matrix

| Subsystem / Feature | Real / Live Mode | Degraded / Fallback Mode | Explicit Demo / Simulated Mode | Required Configuration / Credentials |
|---|---|---|---|---|
| **Primary Weather Data** | Live Open-Meteo REST telemetry with 15-min revalidation | In-memory cached observation snapshot tagged `OFFLINE-CACHED` | Pre-configured meteorological scenarios (`heavy_rain`, `heatwave`, `storm`) tagged `DEMO-SCENARIO` | None (Free Open-Meteo endpoint) |
| **Secondary Weather Data** | Live OpenWeatherMap REST integration | Skipped if key is absent; reverts to single-source Open-Meteo | N/A | `OPENWEATHER_API_KEY` |
| **Multi-Source Consensus** | Median aggregation & spread computation across active sources | Single-source mode (`agreement: SINGLE_SOURCE`) | Synthetic multi-source spreads in demo scenarios | 2+ weather providers active |
| **ML Precipitation (Task A)** | Real-time `HistGradientBoostingRegressor` $T+1$ point prediction with $90\%$ prediction interval | In-process calibrated fallback surrogate trained on 210k samples | Pre-set synthetic test values in demo scenarios tagged `Synthetic Demo ML` | `PYTHON_BIN` or native in-process engine |
| **ML Hazard Classifier (Task B)** | Real-time `HistGradientBoostingClassifier` predicting $P[\text{Rain} > 10\text{ mm/h}]$ | In-process logistic calibrated decision surface | Preset scenario hazard classes | `PYTHON_BIN` or native in-process engine |
| **Foundation NWP (Aurora 1.5)** | Real Aurora 0.1° high-resolution multi-level NWP | Honestly reported as `AURORA_STATUS = NOT_CONFIGURED` (requires 737MB checkpoint, ONNX runtime, 4 static pressure levels) | Never simulated or faked | Azure ML / ONNX Runtime + Weights |
| **Deterministic Risk Engine** | Real-time NDMA/IMD threshold formulas combining weather + ML | Cached verified calculation | Scenario specific hazard calculations | None |
| **Persona Impact Engine** | Real-time deterministic decision trees for 5 personas | Standard citizen safety advice | Persona scenario matrices | None |
| **Ground Reality Fusion** | Live MongoDB-backed verified disaster incident records | Empty incident array tagged `DEGRADED` (no synthetic records injected) | Seed demo incidents explicitly tagged `DEMO-SCENARIO` | `MONGODB_URI` |
| **Grounded LLM & RAG** | Live LLM generation with strict Grounding Guard citation enforcement | 100% deterministic rule-based advice generation (`AI_STATUS = DEGRADED_DETERMINISTIC`) | Pre-computed explanations | `GEMINI_API_KEY` or `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` |
| **Feature-Phone SMS Dispatch** | Real Twilio REST API SMS dispatch to physical mobile number | Returned as `NOT-CONFIGURED` with exact error reason | 160-char formatted text preview mode tagged `SIMULATED` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| **Web Push Notifications** | Real RFC 8291 VAPID Web Push delivery | Logged delivery error; user notified | N/A | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| **Offline PWA** | Service Worker cache + IndexedDB offline store | Stale cache clearly badged `OFFLINE-CACHED` | N/A | Browser Service Worker support |
| **GSM Modem / Hardware AT** | **PERMANENTLY REMOVED FROM SCOPE** | N/A | N/A | Hardware removed |
| **IVR / Voice Calls** | **PERMANENTLY REMOVED FROM SCOPE** | N/A | N/A | Hardware removed |

---

## Strict Data-Honesty Rules

1. **No Fake Accuracy**: All ML performance numbers reported on the admin dashboard originate directly from `ml/models/benchmark_report.json` computed over the 31,557 held-out test split.
2. **No Fake Foundation Model**: Aurora status explicitly declares `NOT-CONFIGURED` with itemized missing dependencies.
3. **No Synthetic Live Feeds**: If live APIs or MongoDB are unreachable, the system explicitly badges responses as `DEGRADED` or `OFFLINE-CACHED` and never pretends synthetic data is live.
4. **No Fake SMS Delivery**: If Twilio credentials are missing, the UI displays `SIMULATED (Feature-Phone Payload Preview)` and never claims an SMS was dispatched to a carrier network.
