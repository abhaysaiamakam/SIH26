"""Loads the versioned JSON config in packages/config/v1/*.json - the same
files packages/config (TypeScript) reads. This keeps priority/objective/
compatibility/solver weights single-sourced across both languages.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def _find_config_dir() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "packages" / "config" / "v1"
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(
        "Could not locate packages/config/v1 by walking up from "
        f"{here} - is the repository layout intact?"
    )


@lru_cache(maxsize=1)
def _config_dir() -> Path:
    return _find_config_dir()


def _load(filename: str) -> dict[str, Any]:
    with open(_config_dir() / filename, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_priority_weights() -> dict[str, Any]:
    return _load("priority-weights.json")


@lru_cache(maxsize=1)
def load_objective_weights() -> dict[str, Any]:
    return _load("objective-weights.json")


@lru_cache(maxsize=1)
def load_compatibility_defaults() -> dict[str, Any]:
    return _load("compatibility-defaults.json")


@lru_cache(maxsize=1)
def load_solver_settings() -> dict[str, Any]:
    return _load("solver-settings.json")
