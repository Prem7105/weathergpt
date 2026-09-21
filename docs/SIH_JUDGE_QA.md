# WeatherGPT — SIH Judge Question & Answer Reference Bank

---

### 1. What is innovative here?
> **Answer:** Most weather platforms stop at descriptive meteorological metrics ($^\circ\text{C}$, $\text{mm}$, $\text{km/h}$). WeatherGPT bridges the "Action Gap" by transforming raw forecasts into localized, persona-tailored risk intelligence through a deterministic risk engine, calibrated ML precipitation intervals, verified ground reality fusion, and a grounding guard that prevents LLM hallucinations.

---

### 2. How is this different from a standard weather app?
> **Answer:** Weather apps tell a user "60% chance of 25mm rain". WeatherGPT calculates physical impact ($0.82$ Severe Flood Risk), checks if nearby underpasses are waterlogged via Ground Reality, and generates distinct operational actions for 5 specific personas (e.g. telling a construction engineer to pause concrete pouring while telling a farmer to inspect field bunds).

---

### 3. Why use Machine Learning?
> **Answer:** Numerical Weather Prediction (NWP) models update on 6-hour cycles and struggle with rapid, micro-local precipitation spikes. We trained scikit-learn `HistGradientBoostingRegressor` and `HistGradientBoostingClassifier` models on 18 atmospheric features to generate $T+1\text{h}$ nowcasting predictions with calibrated 90% prediction intervals.

---

### 4. Why use Microsoft Aurora?
> **Answer:** Microsoft Aurora is an advanced 3D Swin-Transformer foundation model trained on global ERA5/GFS atmospheric reanalysis across 13 pressure levels. It produces multi-member autoregressive rollouts that quantify physical uncertainty spread ($\sigma_T, \sigma_P, \sigma_W$).

---

### 5. Why is Aurora 1.5 Ensemble marked unavailable on this demonstration laptop?
> **Answer:** The full Aurora 1.5 Ensemble (`AuroraV1p5Ensemble`) has 1.26 billion parameters and requires $\ge 24\text{ GB}$ dedicated GPU VRAM or $\ge 32\text{ GB}$ system RAM for global 3D attention tensor rollouts. In accordance with strict data honesty, we report `AURORA_1P5_ENSEMBLE_UNAVAILABLE` on this 6GB VRAM laptop, while running our lightweight operational ML engine (`HistGradientBoosting`) in ~5ms.

---

### 6. How do you prevent LLM hallucinations?
> **Answer:** Emergency decisions must never rely on probabilistic LLM math. In WeatherGPT:
> 1. **Rules Decide:** Risk scores ($0.0 - 1.0$) and action priorities are calculated deterministically by our NDMA/IMD-compliant rule engine.
> 2. **RAG Grounds:** Authoritative guidelines (NDMA, IMD, ICAR, CPWD) are retrieved from an in-memory knowledge store.
> 3. **Grounding Guard:** A post-generation verification layer scans LLM output with regex and numeric bounds; any fabricated temperature, wind speed, or rainfall rate triggers automatic regeneration or deterministic fallback.

---

### 7. How is the risk score calculated?
> **Answer:** Risk score is a normalized deterministic value ($0.0 - 1.0$) computed by evaluating:
> - Precipitation intensity and accumulation against IMD/NDMA warning thresholds (24h accumulation $>64.5\text{mm}$ $\to$ Orange/Red Alert).
> - Environmental saturation & moisture factors.
> - Elevation & drainage vulnerability.
> - Spatial proximity of active ground reality incidents.

---

### 8. Where does the weather data come from?
> **Answer:** Real-time multi-level meteorological feeds are ingested from Open-Meteo API (primary ECMWF IFS & GFS global models), with automatic offline fallback to localized edge cache.

---

### 9. How do you validate Ground Reality incidents?
> **Answer:** Incidents are classified by source trust level:
> - `OFFICIAL`: Government disaster management / traffic police bulletin.
> - `CORROBORATED`: Multiple independent community reports in the same $500\text{m}$ cluster.
> - `REPORTED` / `COMMUNITY_REPORT`: Single citizen submission awaiting verification.
> Incidents also have an exponential temporal half-life decay (2–6 hours) to prevent stale road closures from lingering.

---

### 10. What happens when the internet fails during a disaster?
> **Answer:** WeatherGPT is built as an offline-first Progressive Web App (PWA). It stores the latest verified forecast, risk matrix, and persona decisions in local IndexedDB/localStorage. When offline, the UI prominently displays `OFFLINE — CACHED (Last sync: HH:MM)` and continues providing cached decision support.

---

### 11. How does the system scale?
> **Answer:** The frontend is statically rendered Next.js 14 deployed to edge CDNs. The operational ML engine is lightweight (~5ms inference), and foundation model rollouts are handled asynchronously by background workers with 6-hour disk caching, allowing thousands of concurrent users to query risk intelligence with sub-millisecond cache latency.

---

### 12. How does it support different users?
> **Answer:** WeatherGPT features 5 tailored operational personas:
> 1. **Citizen:** Commuting safety, low-lying underpasses, public transit.
> 2. **Farmer:** Crop waterlogging, irrigation timing, pesticide drift, livestock shelter.
> 3. **Logistics & Fleet:** High-sided expressway transit, underpass diversions, cold-chain integrity.
> 4. **Construction Site Manager:** Crane wind safety thresholds, concrete pour wash-off, excavation shoring.
> 5. **Disaster Authority:** Dewatering pump pre-deployment, emergency shelters, early evacuation triggers.

---

### 13. How do alerts work?
> **Answer:** Alerts are generated automatically whenever risk exceeds `MODERATE` thresholds ($>0.50$). They are dispatched across In-App notification banners, Web Push (VAPID protocol), and Twilio SMS (formatted under 160 characters for feature phones without internet).

---

### 14. What happens if an AI provider fails?
> **Answer:** WeatherGPT employs an automated multi-tier AI fallback cascade:
> `Gemini 1.5 Pro` $\to$ `Claude 3.5 Sonnet` $\to$ `OpenAI GPT-4o` $\to$ `Local Ollama` $\to$ `Deterministic Rule-Based Meteorological Reasoning Engine`.
> The platform never crashes or returns empty answers when an AI API is unreachable.

---

### 15. How do you prevent fabricated weather values?
> **Answer:** Live weather telemetry is passed directly to the UI without passing through an LLM text generator. All numbers in chat responses are strictly validated by `groundingGuard.js` against the raw meteorological JSON.

---

### 16. What makes this useful for Disaster Management authorities?
> **Answer:** Rather than manually correlating radar maps, sensor gauges, and citizen calls, disaster managers get an instant synthesized dashboard showing real-time hazard severity, vulnerable corridors, nearest verified incidents, and automated SMS alert dispatch—saving critical hours during flash floods and cyclones.
