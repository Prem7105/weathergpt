"""Train WeatherGPT's honest short-term precipitation model from Open-Meteo history.

This predicts observed precipitation one hour ahead. It is not a flood-event model.
Run: python ml/training/train_precipitation_model.py
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, precision_recall_fscore_support, roc_auc_score

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

LOCATIONS = {
    "Mumbai": (19.076, 72.8777), "New Delhi": (28.6139, 77.209), "Pune": (18.5204, 73.8567),
    "Chennai": (13.0827, 80.2707), "Kolkata": (22.5726, 88.3639), "Bengaluru": (12.9716, 77.5946),
    "Hyderabad": (17.385, 78.4867), "Ahmedabad": (23.0225, 72.5714), "Guwahati": (26.1445, 91.7362),
    "Jaipur": (26.9124, 75.7873), "Kochi": (9.9312, 76.2673), "Patna": (25.5941, 85.1376),
    "Bhubaneswar": (20.2961, 85.8245), "Srinagar": (34.0837, 74.7973),
}
FEATURES = [
    "precipitation", "temperature_2m", "apparent_temperature", "relative_humidity_2m", "dew_point_2m",
    "surface_pressure", "cloud_cover", "wind_speed_10m", "wind_direction_10m", "hour_sin", "hour_cos",
    "day_sin", "day_cos", "precip_lag_1h", "precip_lag_3h", "precip_lag_6h", "precip_roll_3h", "precip_roll_6h",
]
HOURLY = ",".join(["precipitation", "temperature_2m", "apparent_temperature", "relative_humidity_2m", "dew_point_2m", "surface_pressure", "cloud_cover", "wind_speed_10m", "wind_direction_10m"])

def fetch_location(name: str, lat: float, lon: float, start: str, end: str) -> pd.DataFrame:
    params = {"latitude": lat, "longitude": lon, "start_date": start, "end_date": end, "hourly": HOURLY, "timezone": "UTC"}
    for attempt in range(4):
        response = requests.get("https://archive-api.open-meteo.com/v1/archive", params=params, timeout=120)
        if response.status_code != 429:
            response.raise_for_status()
            break
        time.sleep(8 * (attempt + 1))
    else:
        response.raise_for_status()
    hourly = response.json().get("hourly", {})
    frame = pd.DataFrame({key: hourly.get(key, []) for key in ["time", *HOURLY.split(",")]})
    frame["time"] = pd.to_datetime(frame["time"], utc=True, errors="coerce")
    frame["location"] = name
    return frame

def make_features(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.sort_values(["location", "time"]).drop_duplicates(["location", "time"])
    numeric = [column for column in HOURLY.split(",") if column in frame]
    frame[numeric] = frame[numeric].apply(pd.to_numeric, errors="coerce")
    grouped = frame.groupby("location", group_keys=False)
    frame["hour_sin"] = np.sin(2 * np.pi * frame.time.dt.hour / 24)
    frame["hour_cos"] = np.cos(2 * np.pi * frame.time.dt.hour / 24)
    frame["day_sin"] = np.sin(2 * np.pi * frame.time.dt.dayofyear / 365.25)
    frame["day_cos"] = np.cos(2 * np.pi * frame.time.dt.dayofyear / 365.25)
    frame["precip_lag_1h"] = grouped.precipitation.shift(1)
    frame["precip_lag_3h"] = grouped.precipitation.shift(3)
    frame["precip_lag_6h"] = grouped.precipitation.shift(6)
    frame["precip_roll_3h"] = grouped.precipitation.transform(lambda values: values.shift(1).rolling(3, min_periods=3).sum())
    frame["precip_roll_6h"] = grouped.precipitation.transform(lambda values: values.shift(1).rolling(6, min_periods=6).sum())
    frame["target_next_hour"] = grouped.precipitation.shift(-1)
    return frame.dropna(subset=FEATURES + ["target_next_hour"]).reset_index(drop=True)

def metrics(y_true, predicted):
    occurrence = y_true > 0.1
    predicted_occurrence = predicted > 0.1
    precision, recall, f1, _ = precision_recall_fscore_support(occurrence, predicted_occurrence, average="binary", zero_division=0)
    return {"mae": float(mean_absolute_error(y_true, predicted)), "rmse": float(mean_squared_error(y_true, predicted) ** 0.5), "r2": float(r2_score(y_true, predicted)), "rain_precision": float(precision), "rain_recall": float(recall), "rain_f1": float(f1), "rain_auc": float(roc_auc_score(occurrence, predicted)) if len(np.unique(occurrence)) > 1 else None}

def main():
    start = os.getenv("WEATHERGPT_ML_START", "2021-01-01")
    end = os.getenv("WEATHERGPT_ML_END", "2024-12-31")
    frames = []
    requested_locations = os.getenv("WEATHERGPT_ML_LOCATIONS", "Mumbai,New Delhi,Pune,Chennai,Kolkata,Bengaluru,Hyderabad,Ahmedabad").split(",")
    selected_locations = {name: LOCATIONS[name] for name in requested_locations if name in LOCATIONS}
    for name, (lat, lon) in selected_locations.items():
        print(f"Downloading {name}...")
        frames.append(fetch_location(name, lat, lon, start, end))
        time.sleep(3)
    raw = pd.concat(frames, ignore_index=True)
    prepared = make_features(raw)
    prepared = prepared.sort_values("time").reset_index(drop=True)
    n = len(prepared)
    train_end, valid_end = int(n * .70), int(n * .85)
    train, valid, test = prepared.iloc[:train_end], prepared.iloc[train_end:valid_end], prepared.iloc[valid_end:]
    model = HistGradientBoostingRegressor(max_iter=250, learning_rate=.06, max_leaf_nodes=31, l2_regularization=.2, random_state=42)
    model.fit(train[FEATURES], train.target_next_hour)
    valid_prediction = np.clip(model.predict(valid[FEATURES]), 0, None)
    test_prediction = np.clip(model.predict(test[FEATURES]), 0, None)
    persistence = np.clip(test.precipitation.to_numpy(), 0, None)
    importance = permutation_importance(model, valid[FEATURES].sample(min(5000, len(valid)), random_state=42), valid.loc[valid[FEATURES].sample(min(5000, len(valid)), random_state=42).index, "target_next_hour"], n_repeats=3, random_state=42, scoring="neg_mean_absolute_error")
    top_drivers = sorted(zip(FEATURES, importance.importances_mean), key=lambda pair: pair[1], reverse=True)[:8]
    import joblib
    version = f"precipitation-hgb-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    joblib.dump(model, MODEL_DIR / "precipitation_model.joblib")
    metadata = {"model": "short_term_precipitation", "modelVersion": version, "algorithm": "HistGradientBoostingRegressor", "features": FEATURES, "target": "precipitation at t+1 hour", "trainingPeriod": {"start": start, "end": end}, "locations": list(selected_locations), "samples": {"downloaded": int(len(raw)), "retained": int(len(prepared)), "train": len(train), "validation": len(valid), "test": len(test)}, "metrics": {"persistence": metrics(test.target_next_hour, persistence), "ml": metrics(test.target_next_hour, test_prediction)}, "drivers": [{"feature": name, "importance": float(value)} for name, value in top_drivers], "limitations": ["Predicts precipitation, not floods", "Performance varies by location and weather regime", "Open-Meteo historical observations are the source"], "trainedAt": datetime.utcnow().isoformat() + "Z"}
    (MODEL_DIR / "precipitation_model_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))

if __name__ == "__main__":
    main()
