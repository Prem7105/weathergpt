import json
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "ml" / "models"
MODEL = None
METADATA = None


def finite(value):
    try:
        return value is not None and np.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def load_model():
    global MODEL, METADATA
    if MODEL is None:
        MODEL = joblib.load(MODEL_DIR / "precipitation_model.joblib")
        METADATA = json.loads((MODEL_DIR / "precipitation_model_metadata.json").read_text(encoding="utf-8"))
    return MODEL, METADATA


def hourly_rows(data):
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    fields = {
        "precipitation": "precipitation",
        "temperature": "temperature_2m",
        "apparentTemperature": "apparent_temperature",
        "humidity": "relative_humidity_2m",
        "dewPoint": "dew_point_2m",
        "pressure": "surface_pressure",
        "cloudCover": "cloud_cover",
        "windSpeed": "wind_speed_10m",
        "windDirection": "wind_direction_10m",
    }
    return [
        {"time": time, **{key: (hourly.get(source) or [None] * len(times))[index] for key, source in fields.items()}}
        for index, time in enumerate(times)
    ]


def predict(latitude, longitude):
    query = (
        f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}"
        "&hourly=precipitation,temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,"
        "surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m&forecast_days=2&past_days=1&timezone=auto"
    )
    with urlopen(query, timeout=10) as response:
        data = json.load(response)
    rows = hourly_rows(data)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    selected_index = next((index for index, row in enumerate(rows) if datetime.fromisoformat(row["time"]) >= now), len(rows) - 1)
    current = rows[selected_index]
    history = rows[max(0, selected_index - 12):selected_index]
    required = ["precipitation", "temperature", "apparentTemperature", "humidity", "dewPoint", "pressure", "cloudCover", "windSpeed", "windDirection"]
    if len(history) < 6 or any(not finite(current.get(key)) for key in required) or any(any(not finite(row.get(key)) for key in required) for row in history[-6:]):
        return {"enabled": False, "reason": "Required historical weather features are unavailable for ML inference."}

    timestamp = datetime.fromisoformat(current["time"])
    precipitations = [float(row["precipitation"]) for row in history]
    features = [
        float(current["precipitation"]), float(current["temperature"]), float(current["apparentTemperature"]),
        float(current["humidity"]), float(current["dewPoint"]), float(current["pressure"]),
        float(current["cloudCover"]), float(current["windSpeed"]), float(current["windDirection"]),
        np.sin(2 * np.pi * timestamp.hour / 24), np.cos(2 * np.pi * timestamp.hour / 24),
        np.sin(2 * np.pi * timestamp.timetuple().tm_yday / 365.25), np.cos(2 * np.pi * timestamp.timetuple().tm_yday / 365.25),
        precipitations[-1], precipitations[-3], precipitations[-6], sum(precipitations[-3:]), sum(precipitations[-6:]),
    ]
    model, metadata = load_model()
    prediction = max(0.0, float(model.predict([features])[0]))
    return {
        "enabled": True, "model": metadata["model"], "modelVersion": metadata["modelVersion"],
        "algorithm": metadata["algorithm"], "predictedPrecipitationMm": round(prediction, 3),
        "horizonHours": 1, "inputTimestamp": current["time"], "source": "Open-Meteo",
        "drivers": metadata.get("drivers", []), "features": metadata["features"],
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            params = parse_qs(urlparse(self.path).query)
            latitude = float(params.get("lat", [None])[0])
            longitude = float(params.get("lon", [None])[0])
            if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                raise ValueError("lat and lon must be valid coordinates.")
            body, status = predict(latitude, longitude), 200
        except ValueError as error:
            body, status = {"enabled": False, "reason": str(error)}, 400
        except Exception:
            body, status = {"enabled": False, "reason": "ML inference is temporarily unavailable."}, 503
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, s-maxage=600, stale-while-revalidate=60")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)
