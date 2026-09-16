# WeatherGPT short-term precipitation model

- Purpose: predict observed precipitation one hour ahead; this is not a flood-event predictor.
- Source: Open-Meteo historical hourly observations.
- Training period: 2022-01-01 through 2024-12-31.
- Locations: eight Indian locations (Mumbai, New Delhi, Pune, Chennai, Kolkata, Bengaluru, Hyderabad, Ahmedabad).
- Target: precipitation at `t+1 hour`.
- Model: `HistGradientBoostingRegressor`.
- Features: current weather, cyclical time, precipitation lags (1/3/6 hours), and prior 3/6-hour precipitation totals.
- Split: chronological 70% train, 15% validation, 15% test.
- Metrics and sample counts: `ml/models/precipitation_model_metadata.json`.
- Limitations: no flood labels; output is predicted precipitation only, with provider and location limitations.

Retrain with:

```text
python ml/training/train_precipitation_model.py
```
