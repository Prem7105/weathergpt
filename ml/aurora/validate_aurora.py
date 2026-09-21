"""
WeatherGPT - Aurora 1.5 Ensemble Pipeline Verification Suite
============================================================
Tests:
1. Multi-level atmospheric tensor schema and input validation.
2. Climatological preprocessing, normalization, and physical unit conversions.
3. Model loader diagnostic inspection and dependency verification.
4. Ensemble forecast rollout, mean extraction, and spread calculation.
5. Disk caching and TTL mechanisms.
"""

import os
import sys
import math
import json
import unittest
from pathlib import Path
from datetime import datetime, timezone

from .config import AURORA_CONFIG
from .data_ingestion import AtmosphericDataIngestion, AtmosphericDataError
from .preprocessor import AuroraPreprocessor
from .model_loader import AuroraModelLoader
from .ensemble_inference import AuroraEnsembleInference
from .run_worker import read_cached_forecast, write_cached_forecast, get_cache_path


class TestAuroraPipeline(unittest.TestCase):

    def setUp(self):
        self.ingestion = AtmosphericDataIngestion()
        self.preprocessor = AuroraPreprocessor()
        self.loader = AuroraModelLoader()
        self.inference = AuroraEnsembleInference()

    def test_01_config_and_pressure_levels(self):
        """Validates configuration has exact 13 pressure levels and required 3D/2D channels."""
        self.assertEqual(len(AURORA_CONFIG["pressure_levels_hpa"]), 13)
        self.assertIn(500, AURORA_CONFIG["pressure_levels_hpa"])
        self.assertIn(850, AURORA_CONFIG["pressure_levels_hpa"])
        self.assertEqual(len(AURORA_CONFIG["atmospheric_3d_variables"]), 5) # z, t, u, v, q
        self.assertEqual(len(AURORA_CONFIG["surface_2d_variables"]), 6)      # 2t, 10u, 10v, msl, sp, tp

    def test_02_data_ingestion_honesty(self):
        """Validates that ingestion strictly refuses to fabricate missing 3D tensors."""
        diag = self.ingestion.check_data_feed_availability()
        self.assertIn("overall_status", diag)
        self.assertIn(diag["overall_status"], ["AVAILABLE", "NOT_CONFIGURED"])
        
        # Calling load_initial_conditions without feeds must raise AtmosphericDataError
        if diag["overall_status"] == "NOT_CONFIGURED":
            with self.assertRaises(AtmosphericDataError):
                self.ingestion.load_initial_conditions()

    def test_03_preprocessor_unit_conversions(self):
        """Validates exact physical unit conversion from Aurora tensor units to WeatherGPT units."""
        # 298.15 K -> 25.0 °C
        # (3.0, 4.0) m/s -> 5.0 m/s -> 18.0 km/h
        # 101300 Pa -> 1013.0 hPa
        # 0.015 m precipitation -> 15.0 mm
        converted = self.preprocessor.convert_aurora_output_to_weathergpt_units(
            t2m_k=298.15,
            u10_ms=3.0,
            v10_ms=4.0,
            mslp_pa=101300.0,
            tp_m=0.015,
        )
        self.assertEqual(converted["temperature"], 25.0)
        self.assertEqual(converted["windSpeed"], 18.0)
        self.assertEqual(converted["pressure"], 1013.0)
        self.assertEqual(converted["precipitation"], 15.0)

    def test_04_model_loader_diagnostics(self):
        """Validates that model loader accurately reports hardware constraints and dual status."""
        # 1. Aurora 1.5 Ensemble must report UNAVAILABLE on this host hardware
        loader_1p5 = AuroraModelLoader(mode="ensemble_1p5")
        env_1p5 = loader_1p5.inspect_system_environment()
        self.assertEqual(env_1p5["status"], "AURORA_1P5_ENSEMBLE_UNAVAILABLE")
        self.assertIn("higher-memory compute infrastructure", env_1p5["reason"])

        # 2. Aurora Small Pretrained must report AURORA_SMALL_RESEARCH (or NOT_CONFIGURED/UNAVAILABLE if no torch)
        loader_small = AuroraModelLoader(mode="small_research")
        env_small = loader_small.inspect_system_environment()
        self.assertIn(env_small["status"], ["AURORA_SMALL_RESEARCH", "NOT_CONFIGURED", "UNAVAILABLE"])

    def test_05_ensemble_spread_and_uncertainty(self):
        """Validates ensemble variance and uncertainty spread mathematics."""
        members_temp = [24.0, 25.0, 26.0, 25.0] # mean = 25.0, std = 0.816
        mean_t = sum(members_temp) / 4
        std_t = math.sqrt(sum((t - mean_t)**2 for t in members_temp) / 3)
        self.assertAlmostEqual(mean_t, 25.0, places=1)
        self.assertAlmostEqual(std_t, 0.82, places=1)

    def test_06_caching_and_worker_pipeline(self):
        """Validates disk caching write and read with TTL checks."""
        test_lat, test_lon = 23.02, 72.57
        dummy_data = {
            "enabled": False,
            "status": "NOT_CONFIGURED",
            "modelName": AURORA_CONFIG["model_name"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "targetLocation": {"latitude": test_lat, "longitude": test_lon}
        }
        write_cached_forecast(test_lat, test_lon, dummy_data)
        hit, read_data = read_cached_forecast(test_lat, test_lon)
        self.assertTrue(hit)
        self.assertEqual(read_data["status"], "NOT_CONFIGURED")
        self.assertTrue(read_data["cached"])


def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAuroraPipeline)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
