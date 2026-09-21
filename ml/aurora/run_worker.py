"""
WeatherGPT - Aurora Background Inference Worker & Cache Daemon
==============================================================
Runs Aurora 1.5 Ensemble forecast jobs in a separate background worker process
with disk-backed JSON caching.

Ensures the 1.3B parameter foundation model never executes synchronously
on interactive user chat requests.
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime, timezone

from .config import AURORA_CONFIG, CACHE_DIR
from .ensemble_inference import AuroraEnsembleInference

logger = logging.getLogger("WeatherGPT.Aurora.Worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def get_cache_path(lat: float, lon: float) -> Path:
    """Returns disk cache file path for given coordinates."""
    filename = f"aurora_cache_{round(lat, 2)}_{round(lon, 2)}.json"
    return CACHE_DIR / filename


def read_cached_forecast(lat: float, lon: float) -> tuple[bool, dict]:
    """Reads unexpired forecast from disk cache."""
    path = get_cache_path(lat, lon)
    if not path.exists():
        return False, {}

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        cached_time = datetime.fromisoformat(data.get("timestamp", "1970-01-01T00:00:00+00:00"))
        age_seconds = (datetime.now(timezone.utc) - cached_time).total_seconds()

        if age_seconds < AURORA_CONFIG["cache_ttl_seconds"]:
            data["cached"] = True
            data["cacheAgeSeconds"] = round(age_seconds, 1)
            return True, data
    except Exception as err:
        logger.warning("Failed to read cache file %s: %s", path, err)

    return False, {}


def write_cached_forecast(lat: float, lon: float, data: dict) -> None:
    """Writes forecast data to disk cache."""
    path = get_cache_path(lat, lon)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as err:
        logger.warning("Failed to write cache file %s: %s", path, err)


def main():
    parser = argparse.ArgumentParser(description="WeatherGPT Aurora 1.5 Ensemble Worker")
    parser.add_argument("--lat", type=float, default=23.02, help="Latitude")
    parser.add_argument("--lon", type=float, default=72.57, help="Longitude")
    parser.add_argument("--lead_hours", type=int, default=24, help="Forecast lead hours (e.g. 24)")
    parser.add_argument("--members", type=int, default=4, help="Ensemble members count")
    parser.add_argument("--force_refresh", action="store_true", help="Bypass disk cache")
    parser.add_argument("--json", action="store_true", help="Output pure JSON to stdout")

    args = parser.parse_args()

    # 1. Check disk cache
    if not args.force_refresh:
        hit, cached_data = read_cached_forecast(args.lat, args.lon)
        if hit:
            if args.json:
                print(json.dumps(cached_data))
            else:
                print(f"[CACHE HIT] Returning cached Aurora forecast ({cached_data.get('status')})")
            return

    # 2. Run Ensemble Inference Pipeline
    inference = AuroraEnsembleInference()
    result = inference.run_ensemble_forecast(
        latitude=args.lat,
        longitude=args.lon,
        lead_time_hours=args.lead_hours,
        ensemble_members=args.members,
    )

    # 3. Write to Cache
    write_cached_forecast(args.lat, args.lon, result)

    if args.json:
        print(json.dumps(result))
    else:
        print(f"[AURORA WORKER] Status: {result.get('status')} | Enabled: {result.get('enabled')}")
        if result.get("reason"):
            print(f"Diagnostics: {result.get('reason')}")


if __name__ == "__main__":
    main()
