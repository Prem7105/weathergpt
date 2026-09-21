"""
WeatherGPT - Microsoft Aurora 1.5 Foundation Model Configuration
================================================================
Defines official model architectures, tensor specifications, pressure levels,
surface variables, and hardware runtime requirements for Aurora 1.5 Ensemble.
"""

import os
from pathlib import Path

# Base Paths
AURORA_DIR = Path(__file__).resolve().parent
CACHE_DIR = AURORA_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Official Microsoft Aurora Specifications & Dual Status
AURORA_CONFIG = {
    # 1. Official Target 1.5 Ensemble (1.26B) Configuration
    "ensemble_1p5": {
        "model_name": "Microsoft Aurora 1.5 Ensemble Foundation Model",
        "target_class": "aurora.AuroraV1p5Ensemble",
        "checkpoint_name": "aurora-0.25-v1.5-ensemble.ckpt",
        "parameter_count": 1260184560,
        "status": "AURORA_1P5_ENSEMBLE_UNAVAILABLE",
        "reason": "Full Aurora 1.5 Ensemble requires higher-memory compute infrastructure than the current host.",
        "hardware_requirement": "NVIDIA CUDA GPU with >= 24GB VRAM or >= 32GB RAM compute cluster",
    },
    
    # 2. Aurora Small Pretrained (Research Mode) Configuration
    "small_research": {
        "model_name": "Aurora 0.25° Small Pretrained — Research Mode",
        "target_class": "aurora.AuroraSmallPretrained",
        "checkpoint_name": "aurora-0.25-small-pretrained.ckpt",
        "parameter_count": 112797584,
        "status": "AURORA_SMALL_RESEARCH",
        "mode": "RESEARCH_MODE",
    },
    
    # Common Grid & Atmospheric Schema
    "model_name": "Aurora 0.25° Small Pretrained — Research Mode",
    "checkpoint_id": "microsoft/aurora (aurora-0.25-small-pretrained.ckpt)",
    "checkpoint_path": os.getenv("AURORA_CHECKPOINT_PATH", str(AURORA_DIR / "checkpoints" / "aurora-0.25-small-pretrained.ckpt")),
    "spatial_resolution_deg": 0.25,
    "timestep_hours": 6,
    "history_steps": 2,
    
    # 13 Atmospheric Pressure Levels (hPa)
    "pressure_levels_hpa": [
        50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 925, 1000
    ],
    
    # Atmospheric Multi-Level 3D Variables (5 variables per level -> 65 3D channels)
    "atmospheric_3d_variables": [
        "z",  # Geopotential (m^2 / s^2)
        "t",  # Temperature (K)
        "u",  # U-component of horizontal wind (m / s)
        "v",  # V-component of horizontal wind (m / s)
        "q",  # Specific humidity (kg / kg)
    ],
    
    # Surface 2D Variables (6 channels)
    "surface_2d_variables": [
        "2t",   # 2-meter temperature (K)
        "10u",  # 10-meter U-wind component (m / s)
        "10v",  # 10-meter V-wind component (m / s)
        "msl",  # Mean sea level pressure (Pa)
        "sp",   # Surface pressure (Pa)
        "tp",   # Total precipitation (m or mm accumulation)
    ],
    
    # Static Geophysical Boundary Fields (3 channels)
    "static_variables": [
        "lsm",  # Land-sea mask (fraction 0-1)
        "z_sfc",# Surface geopotential / orography (m^2 / s^2)
        "slt",  # Soil type category
    ],
    
    # Ensemble Configuration
    "default_ensemble_members": int(os.getenv("AURORA_ENSEMBLE_MEMBERS", "4")),
    "max_ensemble_members": 10,
    "perturbation_scale": 0.02,
    
    # Hardware Requirements & Limits
    "min_gpu_vram_gb": 12.0,
    "recommended_gpu_vram_gb": 24.0,
    "host_gpu_vram_gb": 6.0,
    "host_ram_gb": 15.7,
    
    # Cache Policy
    "cache_ttl_seconds": 21600,   # 6-hour cache validity
}
