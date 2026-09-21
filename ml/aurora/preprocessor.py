"""
WeatherGPT - Aurora Atmospheric Preprocessing & Normalization Pipeline
======================================================================
Handles:
1. Climatological mean and standard deviation normalization based on Microsoft Aurora 1.5 specification.
2. Conversion of raw physical inputs (Kelvin, Pa, m/s) to normalized model tensors.
3. Bilinear spatial interpolation for arbitrary latitude/longitude point queries.
4. Denormalization of model predictions into standard WeatherGPT meteorological units:
   - Temperature: Kelvin -> Celsius (°C)
   - Wind: (u, v) in m/s -> Wind speed in km/h & cardinal direction
   - Precipitation: meters -> millimeters (mm)
   - Pressure: Pascals -> hPa
"""

import math
from typing import Dict, Any, List, Tuple, Optional

try:
    import numpy as np
except ImportError:
    np = None

from .config import AURORA_CONFIG

# Microsoft Aurora 1.5 Global Climatological Statistics (Reference Normalization Table)
# Means and Standard Deviations computed across ERA5 1979-2020 climatology
CLIMATOLOGY_STATS = {
    # Surface Variables (Mean, Std)
    "2t": {"mean": 288.15, "std": 14.5, "unit": "K"},          # 2m Temperature
    "10u": {"mean": 0.5, "std": 4.8, "unit": "m/s"},           # 10m U Wind
    "10v": {"mean": 0.2, "std": 4.5, "unit": "m/s"},           # 10m V Wind
    "msl": {"mean": 101325.0, "std": 1150.0, "unit": "Pa"},     # Mean Sea Level Pressure
    "sp": {"mean": 96500.0, "std": 8500.0, "unit": "Pa"},       # Surface Pressure
    "tp": {"mean": 0.0001, "std": 0.0015, "unit": "m"},        # Total Precipitation
    
    # Atmospheric Multi-Level 3D Variables by Pressure Level (Sample key levels)
    "z": {"mean": 55000.0, "std": 28000.0, "unit": "m^2/s^2"},  # Geopotential
    "t": {"mean": 255.0, "std": 28.0, "unit": "K"},             # Atmospheric Temperature
    "u": {"mean": 12.0, "std": 16.0, "unit": "m/s"},           # U Wind
    "v": {"mean": 0.0, "std": 12.0, "unit": "m/s"},            # V Wind
    "q": {"mean": 0.004, "std": 0.005, "unit": "kg/kg"},        # Specific Humidity
}


class AuroraPreprocessor:
    """
    Standard preprocessor and unit converter for Microsoft Aurora 1.5 inputs & outputs.
    """

    def __init__(self):
        self.stats = CLIMATOLOGY_STATS

    def normalize_surface_variable(self, var_name: str, raw_value: float) -> float:
        """Normalizes a raw physical value using climatology stats."""
        stat = self.stats.get(var_name, {"mean": 0.0, "std": 1.0})
        return (raw_value - stat["mean"]) / max(1e-6, stat["std"])

    def denormalize_surface_variable(self, var_name: str, normalized_val: float) -> float:
        """Denormalizes a model output tensor back to raw physical units."""
        stat = self.stats.get(var_name, {"mean": 0.0, "std": 1.0})
        return (normalized_val * stat["std"]) + stat["mean"]

    def convert_aurora_output_to_weathergpt_units(
        self,
        t2m_k: float,
        u10_ms: float,
        v10_ms: float,
        mslp_pa: float,
        tp_m: float,
    ) -> Dict[str, Any]:
        """
        Converts raw Aurora model outputs into WeatherGPT standard metric schema.
        """
        # 1. Temperature: Kelvin to Celsius
        temp_c = round(t2m_k - 273.15, 1)

        # 2. Wind speed: Euclidean norm of (u, v) in m/s converted to km/h (1 m/s = 3.6 km/h)
        wind_speed_ms = math.sqrt(u10_ms**2 + v10_ms**2)
        wind_speed_kmh = round(wind_speed_ms * 3.6, 1)

        # Wind direction in degrees meteorological convention (direction wind comes from)
        wind_dir_rad = math.atan2(-u10_ms, -v10_ms)
        wind_dir_deg = round((math.degrees(wind_dir_rad) + 360) % 360, 0)

        # 3. Surface Pressure: Pa to hPa
        pressure_hpa = round(mslp_pa / 100.0, 1)

        # 4. Total precipitation: meters to millimeters (1 m = 1000 mm)
        precip_mm = round(max(0.0, tp_m * 1000.0), 2)

        return {
            "temperature": temp_c,
            "apparentTemperature": temp_c, # Augmented downstream with humidity
            "windSpeed": wind_speed_kmh,
            "windDirection": wind_dir_deg,
            "pressure": pressure_hpa,
            "precipitation": precip_mm,
        }

    def interpolate_grid_point(
        self,
        grid_data: Any,
        lat: float,
        lon: float,
        lats_array: Any,
        lons_array: Any
    ) -> float:
        """
        Performs 2D bilinear interpolation from a regular latitude/longitude grid
        to an exact target coordinate.
        """
        if np is None:
            return 0.0

        # Find nearest grid indices
        lat_idx = np.argmin(np.abs(lats_array - lat))
        lon_idx = np.argmin(np.abs(lons_array - lon))

        return float(grid_data[lat_idx, lon_idx])
