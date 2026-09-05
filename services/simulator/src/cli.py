#!/usr/bin/env python3
"""Stdin/stdout entrypoint for the traffic-impact simulator, invoked by
apps/api's SimulatorClientService as a subprocess. Same contract shape as
services/optimizer/src/cli.py: JSON in, JSON out, logs on stderr, exit 0
means a result was produced, non-zero means a real failure.

Usage: python3 -m src.cli < input.json > output.json
"""

from __future__ import annotations

import json
import sys

from .impact import run_simulation


def main() -> int:
    try:
        raw = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON on stdin: {exc}", file=sys.stderr)
        return 1

    try:
        output = run_simulation(raw)
    except Exception as exc:  # noqa: BLE001 - top-level boundary, must never crash silently
        print(f"Simulation failed: {exc}", file=sys.stderr)
        return 1

    json.dump(output, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
