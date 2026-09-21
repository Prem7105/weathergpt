# WeatherGPT Project Audit & ML Upgrade Plan

**Audit Timestamp:** September 20, 2026  
**Auditor:** WeatherGPT Lead AI/ML Engineering  
**Baseline Status:** Hardened production baseline with verified golden pipeline.

---

## 1. Audit Summary

### A. Already Working
1. **Live Open-Meteo Weather Ingestion:** Real-time current conditions, hourly (24h), and daily (7d) forecasts across India.
2. **Deterministic Multi-Hazard Risk Engine:** Mathematical scoring for Flood, Heat, Wind, and Storm with strict thresholds (LOW, MODERATE, HIGH, SEVERE).
3. **Contextual Physical Impact Engine:** Deterministic mapping of hazards and severity levels to explainable physical disruptions.
4. **5 Differentiated Persona Decision Profiles:** Distinct, role-specific action guidance for Citizen, Farmer, Logistics, Construction, and Authority.
5. **Ground Reality Situational Fusion:** Geospatial distance (<15 km) and temporal decay (<6 h) filtering of corroborated community and municipal incidents.
6. **Authoritative RAG Knowledge Retrieval:** Deterministic matching of NDMA, IMD, ICAR, NHAI, CPWD, DGFASLI, BIS, and INCOIS standard operating procedures.
7. **AI Numerical Grounding Guard:** Strict validation of AI response numbers, unit normalization, and rejection of hallucinated measurements.
8. **Multi-Channel Alert Engine:** In-app reactive banners, Web Push, and Twilio SMS with honest delivery/simulation status reporting.
9. **Security Architecture:** AES-256-GCM encryption of PII, HMAC-SHA256 blind indexing, httpOnly signed sessions.

### B. Already Production-Worthy
- Next.js 14 App Router production build (0 compile errors, static page optimization).
- Offline storage & PWA caching with explicit `OFFLINE-CACHED` and staleness labeling.
- Clean separation: **ML Predicts $\bullet$ Rules Decide $\bullet$ Ground Reality Contextualizes $\bullet$ RAG Grounds $\bullet$ LLM Explains $\bullet$ Alerts Act**.

### C. Reusable
- Existing `HistGradientBoostingRegressor` model artifacts and metadata in `ml/models/`.
- Python inference script `ml/inference/predict_precipitation.py` and Node.js bridge `src/lib/mlPrecipitation.js`.
- Responsive Leaflet Risk Map (`src/app/risk/risk-map.jsx`) and City Comparison modal (`CompareModal.jsx`).

### D. Needs Improvement
1. **Dual-Task ML Architecture:** Add **Task B (Hazard Classification)** alongside **Task A (Point Prediction)** with calibrated hazard probabilities.
2. **Uncertainty & Prediction Intervals:** Predict confidence intervals (e.g. 90% prediction bounds $[P_{low}, P_{high}]$) rather than point estimates alone.
3. **Multi-Source Consensus:** Implement unified provider abstraction (Open-Meteo, OpenWeather, WeatherStack) and source agreement calculation.
4. **Model Benchmarking & Model Evaluation Dashboard:** Create an internal ML evaluation view `/admin/ml` showing genuine benchmark metrics on held-out test data (MAE, RMSE, $R^2$, F1, Recall, Precision, Brier Score, Latency).
5. **Bias Correction Module:** Provide a localized forecast bias correction module evaluated on held-out data.

### E. Missing
- Dedicated ML Evaluation Dashboard page for judges (`/admin/ml`).
- Formal documentation: `docs/ML_MODEL_DECISION.md`, `docs/ML_EVALUATION.md`, `docs/ML_DATA_PIPELINE.md`, `docs/LOCAL_INTEGRATION_STATUS.md`.

### F. Must NOT Be Changed
- The golden pipeline flow and deterministic safety override rules.
- Existing working UI components, modals, and styling.
- Absolute ban on GSM, IVR, and voice call alerts.
- Absolute ban on Reinforcement Learning (explicitly documented why supervised learning is the correct technical paradigm).
