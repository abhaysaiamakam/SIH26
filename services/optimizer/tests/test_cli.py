import json
import subprocess
import sys
from pathlib import Path

FIXTURE_PATH = Path(__file__).parent.parent.parent.parent / "packages" / "test-fixtures" / "optimizer" / "scenario-seed-42.json"


def run_cli(payload: dict) -> tuple[int, dict | None, str]:
    proc = subprocess.run(
        [sys.executable, "-m", "src.cli"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    stdout = json.loads(proc.stdout) if proc.stdout.strip() else None
    return proc.returncode, stdout, proc.stderr


def test_cli_rejects_malformed_input_with_nonzero_exit_and_stderr_message():
    code, stdout, stderr = run_cli({"bad": "input"})
    assert code != 0
    assert stdout is None
    assert "OptimizerRunInput" in stderr


def test_cli_succeeds_on_a_minimal_valid_scenario():
    payload = {
        "scenarioId": "s1",
        "strategy": "FIRST_FEASIBLE",
        "configVersion": "v1",
        "corridors": [{"id": "c1", "code": "C-01"}],
        "trackResources": [],
        "maintenanceRequests": [
            {
                "id": "t1",
                "department": "ENGINEERING",
                "assetId": "a1",
                "assetCriticality": "HIGH",
                "corridorId": "c1",
                "segmentId": None,
                "workType": "GENERAL_INSPECTION",
                "criticality": "HIGH",
                "urgency": "HIGH",
                "dueDate": "2026-09-01T00:00:00Z",
                "estimatedDurationMinutes": 60,
                "requiredIsolation": "NONE",
                "requiredPower": "NONE",
                "requiredResources": [],
                "status": "OPEN",
            }
        ],
        "requestDependencies": [],
        "taskCompatibilityRules": [],
        "blockWindows": [
            {
                "id": "w1",
                "corridorId": "c1",
                "segmentId": None,
                "startTime": "2026-09-06T01:00:00Z",
                "endTime": "2026-09-06T05:00:00Z",
                "durationMinutes": 240,
                "permittedDepartments": ["ENGINEERING", "TRD", "S_AND_T"],
                "allowsIsolationTypes": ["NONE"],
                "allowsPowerTypes": ["NONE"],
                "maxConcurrentResources": None,
            }
        ],
        "trainMovements": [],
        "options": {"timeLimitSeconds": 5, "randomSeed": 42, "asOf": "2026-09-05T00:00:00Z"},
    }
    code, stdout, stderr = run_cli(payload)
    assert code == 0, stderr
    assert stdout["status"] == "SUCCEEDED"
    assert stdout["selectedCandidateIds"] == ["cand-1"]
    assert stdout["taskOutcomes"][0]["scheduled"] is True


def test_shared_fixture_parses_and_produces_a_plan_if_present():
    """packages/test-fixtures/optimizer/scenario-seed-42.json is exported
    from the TypeScript synthetic generator (see data/synthetic) - this
    keeps the TS and Python sides of the optimizer contract honest without
    codegen. Skipped if the fixture hasn't been (re)generated yet."""
    if not FIXTURE_PATH.exists():
        return
    payload = json.loads(FIXTURE_PATH.read_text())
    payload["strategy"] = "OPTIMIZED"
    code, stdout, stderr = run_cli(payload)
    assert code == 0, stderr
    assert stdout["status"] in ("SUCCEEDED", "NO_FEASIBLE_PLAN")
    assert stdout["diagnostics"]["candidateCount"] > 0
