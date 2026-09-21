# Known System Scope & Honest Limitations

WeatherGPT adheres to strict data-honesty standards and transparently documents all operational boundaries and external dependencies.

---

## 1. Meteorological & Spatial Limitations

1. **Weather Signals vs. Official IMD Radar:** Weather risk calculations are derived from Open-Meteo numerical weather prediction models and physical formulas. They provide interpretable operational decision-support scores, not official statutory warnings issued by the India Meteorological Department (IMD).
2. **Storm Spatial Heatmap:** Regional spatial grid overlays are active for precipitation, heat, and wind. Storm hazard does not currently have a regional convective radar feed, and is transparently labeled as `localized` (pinned to the selected coordinate).
3. **Cyclone Tracking:** Cyclone tracking requires specialized radar/satellite track data feeds from IMD/RSMC. In the absence of an active track feed, storm signals indicate gale winds but explicitly state that a cyclone is not confirmed.

---

## 2. Machine Learning Limitations

1. **ML Scope:** The scikit-learn `HistGradientBoostingRegressor` model predicts 1-hour ahead precipitation (mm). It does **not** directly predict flash floods or infrastructure collapse.
2. **Model Training Data:** The model was trained on historical Open-Meteo observations across 8 major Indian cities (2022–2024). Performance varies across micro-climatic zones and unobserved extreme anomalies.
3. **Rule Supremacy:** Safety decisions are always governed by deterministic safety rules; ML inference acts purely as an input feature to the flood risk formula.

---

## 3. Telephony & Provider Dependencies

1. **Twilio SMS:** SMS delivery requires a live Twilio account with funded credits. In the absence of credentials, the platform operates in honest `SIMULATED` formatting mode and clearly notes that no SMS was sent.
2. **Removed Legacy Features:** GSM hardware modems, voice call alerts, and IVR systems were evaluated in earlier prototypes and have been **permanently removed from scope** in favor of reliable Web Push, in-app notifications, and Twilio SMS.
