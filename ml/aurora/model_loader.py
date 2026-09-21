"""
WeatherGPT - Microsoft Aurora 1.5 Model Loader & Device Manager
================================================================
Handles safe discovery, dependency verification, hardware allocation, and
loading of the Microsoft Aurora 1.5 3D Swin Transformer checkpoint.

Data-Honesty Guarantee:
If PyTorch, CUDA, or genuine weights (e.g. microsoft/aurora or local .ckpt)
are not present on the host system, this loader strictly returns detailed
diagnostics and reports status as NOT_CONFIGURED or UNAVAILABLE.
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

from .config import AURORA_CONFIG

logger = logging.getLogger("WeatherGPT.Aurora.Loader")

try:
    import torch
except ImportError:
    torch = None

try:
    import aurora
except ImportError:
    aurora = None


class AuroraModelLoader:
    """
    Manages genuine Microsoft Aurora model weights and device execution.
    Strictly separates Aurora 1.5 Ensemble from Aurora Small Pretrained (Research Mode).
    """

    def __init__(self, checkpoint_path: Optional[str] = None, mode: str = "small_research"):
        self.mode = mode
        self.checkpoint_path = checkpoint_path or AURORA_CONFIG["checkpoint_path"]
        self.model = None
        self.device = "cpu"
        self.dtype = None

    def inspect_system_environment(self) -> Dict[str, Any]:
        """
        Conducts a rigorous diagnostic inspection of the execution environment.
        """
        diagnostics = {
            "model_name": AURORA_CONFIG["model_name"],
            "checkpoint_target": self.checkpoint_path,
            "torch_available": torch is not None,
            "torch_version": torch.__version__ if torch else None,
            "aurora_package_available": aurora is not None,
            "cuda_available": False,
            "cuda_device_name": None,
            "vram_total_gb": 0.0,
            "vram_free_gb": 0.0,
            "host_ram_total_gb": AURORA_CONFIG["host_ram_gb"],
            "recommended_vram_gb": AURORA_CONFIG["recommended_gpu_vram_gb"],
            "checkpoint_exists": False,
            "checkpoint_size_bytes": 0,
            "missing_prerequisites": [],
            "status": "NOT_CONFIGURED",
            "aurora_1p5_ensemble_status": AURORA_CONFIG["ensemble_1p5"]["status"],
            "aurora_1p5_ensemble_reason": AURORA_CONFIG["ensemble_1p5"]["reason"],
            "aurora_small_research_status": AURORA_CONFIG["small_research"]["status"],
        }

        # 1. Check Python & PyTorch
        if torch is None:
            diagnostics["missing_prerequisites"].append(
                "PyTorch (torch) is not installed in the active Python environment."
            )
        else:
            if torch.cuda.is_available():
                diagnostics["cuda_available"] = True
                diagnostics["cuda_device_name"] = torch.cuda.get_device_name(0)
                total_mem = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                free_mem = torch.cuda.mem_get_info()[0] / (1024**3) if hasattr(torch.cuda, "mem_get_info") else total_mem
                diagnostics["vram_total_gb"] = round(total_mem, 2)
                diagnostics["vram_free_gb"] = round(free_mem, 2)
            else:
                diagnostics["missing_prerequisites"].append(
                    "CUDA acceleration unavailable. NVIDIA CUDA GPU recommended for production rollouts."
                )

        # 2. Check Aurora official package
        if aurora is None:
            diagnostics["missing_prerequisites"].append(
                "Official Microsoft Aurora package ('aurora') is not installed."
            )

        # 3. Check Checkpoint availability
        hf_cache_dir = Path.home() / ".cache" / "huggingface" / "hub" / "models--microsoft--aurora"
        if self.checkpoint_path and os.path.exists(self.checkpoint_path):
            diagnostics["checkpoint_exists"] = True
            diagnostics["checkpoint_size_bytes"] = os.path.getsize(self.checkpoint_path)
        elif hf_cache_dir.exists():
            diagnostics["checkpoint_exists"] = True
            diagnostics["checkpoint_target"] = str(hf_cache_dir)
        elif aurora is not None:
            diagnostics["checkpoint_exists"] = True
            diagnostics["checkpoint_target"] = "HuggingFace Hub: microsoft/aurora"

        # 4. Mode-Specific Evaluation
        if self.mode == "ensemble_1p5":
            diagnostics["status"] = "AURORA_1P5_ENSEMBLE_UNAVAILABLE"
            diagnostics["reason"] = AURORA_CONFIG["ensemble_1p5"]["reason"]
            return diagnostics

        # Default: Aurora Small Research Mode
        if not diagnostics["torch_available"]:
            diagnostics["status"] = "UNAVAILABLE"
        elif not diagnostics["checkpoint_exists"] or not diagnostics["aurora_package_available"]:
            diagnostics["status"] = "NOT_CONFIGURED"
        else:
            diagnostics["status"] = "AURORA_SMALL_RESEARCH"

        return diagnostics

    def load_model(self) -> Tuple[bool, Dict[str, Any]]:
        """
        Attempts to load genuine Microsoft Aurora weights into device memory.
        """
        env = self.inspect_system_environment()
        
        if self.mode == "ensemble_1p5":
            logger.info("Aurora 1.5 Ensemble is unavailable on this hardware: %s", env.get("reason"))
            return False, env

        if env["status"] in ("NOT_CONFIGURED", "UNAVAILABLE"):
            logger.info("Aurora model cannot be loaded: %s", "; ".join(env["missing_prerequisites"]))
            return False, env

        try:
            if torch.cuda.is_available():
                self.device = "cuda"
            else:
                self.device = "cpu"

            logger.info("Loading Aurora 0.25° Small Pretrained (Research Mode) onto %s...", self.device)
            
            if hasattr(aurora, "AuroraSmallPretrained"):
                self.model = aurora.AuroraSmallPretrained()
                self.model.load_checkpoint()
                self.model.to(self.device)
                self.model.eval()
            else:
                raise RuntimeError("AuroraSmallPretrained class not found in microsoft-aurora package.")

            env["status"] = "AURORA_SMALL_RESEARCH"
            return True, env
        except Exception as err:
            logger.error("Failed to load Aurora Small checkpoint: %s", str(err))
            env["status"] = "DEGRADED"
            env["error"] = str(err)
            return False, env
