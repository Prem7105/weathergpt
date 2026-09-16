import json
import sys
from pathlib import Path
import numpy as np
import joblib

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / 'ml' / 'models'

def finite(value):
    try:
        return value is not None and np.isfinite(float(value))
    except (TypeError, ValueError):
        return False

def main():
    payload = json.load(sys.stdin)
    metadata = json.loads((MODEL_DIR / 'precipitation_model_metadata.json').read_text(encoding='utf-8'))
    model = joblib.load(MODEL_DIR / 'precipitation_model.joblib')
    raw = payload.get('current', {})
    history = payload.get('history', [])
    required = ['precipitation', 'temperature', 'apparentTemperature', 'humidity', 'dewPoint', 'pressure', 'cloudCover', 'windSpeed', 'windDirection']
    if len(history) < 6 or any(not finite(raw.get(key)) for key in required) or any(any(not finite(item.get(key)) for key in required) for item in history[-6:]):
        print(json.dumps({'enabled': False, 'reason': 'Required historical weather features are unavailable for ML inference.'}))
        return
    precip = float(raw['precipitation'])
    values = [float(item['precipitation']) for item in history]
    def lag(count): return values[-count]
    def rolling(count): return sum(values[-count:])
    hour = int(payload.get('hour', 0))
    day = int(payload.get('dayOfYear', 1))
    features = [
        precip, float(raw['temperature']), float(raw['apparentTemperature']), float(raw['humidity']),
        float(raw['dewPoint']), float(raw['pressure']), float(raw['cloudCover']), float(raw['windSpeed']),
        float(raw['windDirection']), np.sin(2*np.pi*hour/24), np.cos(2*np.pi*hour/24), np.sin(2*np.pi*day/365.25), np.cos(2*np.pi*day/365.25),
        lag(1), lag(3), lag(6), rolling(3), rolling(6),
    ]
    prediction = max(0.0, float(model.predict([features])[0]))
    print(json.dumps({'enabled': True, 'model': metadata['model'], 'modelVersion': metadata['modelVersion'], 'algorithm': metadata['algorithm'], 'predictedPrecipitationMm': round(prediction, 3), 'horizonHours': 1, 'inputTimestamp': payload.get('timestamp'), 'source': 'Open-Meteo', 'drivers': metadata.get('drivers', []), 'features': metadata['features']}))

if __name__ == '__main__':
    main()
