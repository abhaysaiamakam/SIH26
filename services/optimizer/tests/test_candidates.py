from datetime import timedelta

from factories import NOW, make_resource, make_task, make_window
from src.core.bundling_engine import BundlePair, find_bundle_pairs
from src.core.candidates import evaluate_candidate, generate_candidates
from src.core.compatibility_engine import check_compatibility
from src.core.config_loader import load_compatibility_defaults
from src.core.models import Dependency, NormalizedScenario, RequiredResource, TrainMovement

DEFAULTS = load_compatibility_defaults()


def scenario(tasks=(), windows=(), trains=(), dependencies=(), resources=None, rules=()):
    return NormalizedScenario(
        scenario_id="s1",
        strategy="OPTIMIZED",
        config_version="v1",
        as_of=NOW,
        tasks=tasks,
        dependencies=dependencies,
        compatibility_rules=rules,
        block_windows=windows,
        train_movements=trains,
        resources_by_id=resources or {},
    )


# ── evaluate_candidate: one test per rejection reason ───────────────────


def test_single_task_feasible_candidate():
    task = make_task("t1", estimated_duration_minutes=60)
    window = make_window("w1", duration_minutes=240)
    feasible, reason, delay = evaluate_candidate([task], window, {}, (), ())
    assert feasible is True
    assert reason is None
    assert delay == 0


def test_corridor_mismatch():
    task = make_task("t1", corridor_id="c1")
    window = make_window("w1", corridor_id="c2")
    feasible, reason, _ = evaluate_candidate([task], window, {}, (), ())
    assert feasible is False
    assert reason == "CORRIDOR_MISMATCH"


def test_insufficient_window_duration():
    task = make_task("t1", estimated_duration_minutes=300)
    window = make_window("w1", duration_minutes=120)
    feasible, reason, _ = evaluate_candidate([task], window, {}, (), ())
    assert feasible is False
    assert reason == "INSUFFICIENT_WINDOW_DURATION"


def test_isolation_mismatch():
    task = make_task("t1", required_isolation="POWER_ISOLATION")
    window = make_window("w1", allows_isolation_types=("TRACK_ISOLATION",))
    feasible, reason, _ = evaluate_candidate([task], window, {}, (), ())
    assert feasible is False
    assert reason == "ISOLATION_MISMATCH"


def test_power_requirement_unavailable():
    task = make_task("t1", required_power="TRACTION_POWER_OFF")
    window = make_window("w1", allows_power_types=("NONE",))
    feasible, reason, _ = evaluate_candidate([task], window, {}, (), ())
    assert feasible is False
    assert reason == "POWER_REQUIREMENT_UNAVAILABLE"


def test_resource_unavailable_when_quantity_exceeds_capacity():
    resource = make_resource("r1", capacity=1)
    task = make_task("t1", required_resources=(RequiredResource(resource_id="r1", quantity=2),))
    window = make_window("w1")
    feasible, reason, _ = evaluate_candidate([task], window, {"r1": resource}, (), ())
    assert feasible is False
    assert reason == "RESOURCE_UNAVAILABLE"


def test_resource_unavailable_when_window_resource_slots_exceeded():
    r1 = make_resource("r1")
    r2 = make_resource("r2")
    task = make_task(
        "t1",
        required_resources=(RequiredResource(resource_id="r1", quantity=1), RequiredResource(resource_id="r2", quantity=1)),
    )
    window = make_window("w1", max_concurrent_resources=1)
    feasible, reason, _ = evaluate_candidate([task], window, {"r1": r1, "r2": r2}, (), ())
    assert feasible is False
    assert reason == "RESOURCE_UNAVAILABLE"


def test_operational_conflict_when_department_not_permitted():
    task = make_task("t1", department="TRD")
    window = make_window("w1", permitted_departments=("ENGINEERING",))
    feasible, reason, _ = evaluate_candidate([task], window, {}, (), ())
    assert feasible is False
    assert reason == "OPERATIONAL_CONFLICT"


def test_operational_conflict_when_passenger_train_overlaps():
    task = make_task("t1", estimated_duration_minutes=60)
    window = make_window("w1", start_time=NOW, duration_minutes=120)
    train = TrainMovement(
        id="tm1",
        train_number="101",
        train_type="EXPRESS",
        corridor_id="corridor-1",
        segment_id=None,
        scheduled_start=NOW + timedelta(minutes=10),
        scheduled_end=NOW + timedelta(minutes=40),
        priority=9,
    )
    feasible, reason, _ = evaluate_candidate([task], window, {}, (train,), ())
    assert feasible is False
    assert reason == "OPERATIONAL_CONFLICT"


def test_goods_train_overlap_is_a_soft_conflict_with_delay_not_rejection():
    task = make_task("t1", estimated_duration_minutes=60)
    window = make_window("w1", start_time=NOW, duration_minutes=120)
    train = TrainMovement(
        id="tm1",
        train_number="601",
        train_type="GOODS",
        corridor_id="corridor-1",
        segment_id=None,
        scheduled_start=NOW + timedelta(minutes=10),
        scheduled_end=NOW + timedelta(minutes=40),
        priority=3,
    )
    feasible, reason, delay = evaluate_candidate([task], window, {}, (train,), ())
    assert feasible is True
    assert reason is None
    assert delay == 30


def test_incompatible_work_types_rejects_bundle_candidate():
    a = make_task("a", department="ENGINEERING", work_type="BRIDGE_INSPECTION")
    b = make_task("b", department="ENGINEERING", work_type="BALLAST_CLEANING")
    window = make_window("w1")
    feasible, reason, _ = evaluate_candidate([a, b], window, {}, (), ())
    assert feasible is False
    assert reason == "INCOMPATIBLE_WORK_TYPES"


# ── generate_candidates: dependency feasibility and end-to-end wiring ───


def test_dependency_success_when_predecessor_candidate_ends_before_successor_starts():
    predecessor = make_task("pred", estimated_duration_minutes=60, due_date=NOW)
    successor = make_task("succ", estimated_duration_minutes=60, due_date=NOW + timedelta(days=5))
    window_early = make_window("w-early", start_time=NOW, duration_minutes=120)
    window_late = make_window("w-late", start_time=NOW + timedelta(days=1), duration_minutes=120)

    s = scenario(
        tasks=(predecessor, successor),
        windows=(window_early, window_late),
        dependencies=(Dependency(predecessor_id="pred", successor_id="succ"),),
    )
    candidates = generate_candidates(s, ())
    successor_candidates = [c for c in candidates if c.task_ids == ("succ",)]
    # The successor candidate in window_late starts after window_early's
    # predecessor candidate ends, so it should remain feasible.
    late_candidate = next(c for c in successor_candidates if c.block_window_id == "w-late")
    assert late_candidate.feasible is True


def test_dependency_failure_when_no_predecessor_candidate_ends_in_time():
    predecessor = make_task("pred", estimated_duration_minutes=60, due_date=NOW)
    successor = make_task("succ", estimated_duration_minutes=60, due_date=NOW)
    # Only one shared window, and the predecessor and successor would need
    # the exact same slot - the successor can never start after the
    # predecessor's candidate ends.
    window = make_window("w1", start_time=NOW, duration_minutes=120)

    s = scenario(
        tasks=(predecessor, successor),
        windows=(window,),
        dependencies=(Dependency(predecessor_id="pred", successor_id="succ"),),
    )
    candidates = generate_candidates(s, ())
    successor_candidates = [c for c in candidates if c.task_ids == ("succ",)]
    assert all(c.feasible is False and c.rejection_reason == "DEPENDENCY_NOT_FEASIBLE" for c in successor_candidates)


def test_dependency_failure_when_predecessor_has_no_feasible_candidate_at_all():
    predecessor = make_task("pred", corridor_id="c1", estimated_duration_minutes=999)  # never fits any window
    successor = make_task("succ", corridor_id="c1", estimated_duration_minutes=60)
    window = make_window("w1", corridor_id="c1", start_time=NOW, duration_minutes=120)

    s = scenario(
        tasks=(predecessor, successor),
        windows=(window,),
        dependencies=(Dependency(predecessor_id="pred", successor_id="succ"),),
    )
    candidates = generate_candidates(s, ())
    successor_candidates = [c for c in candidates if c.task_ids == ("succ",)]
    assert all(c.rejection_reason == "DEPENDENCY_NOT_FEASIBLE" for c in successor_candidates)


def test_multiple_predecessor_candidates_only_one_needs_to_satisfy_the_dependency():
    predecessor = make_task("pred", estimated_duration_minutes=60, due_date=NOW)
    successor = make_task("succ", estimated_duration_minutes=60, due_date=NOW)
    window_a = make_window("w-a", start_time=NOW, duration_minutes=120)  # overlaps successor's only window
    window_b = make_window("w-b", start_time=NOW - timedelta(days=1), duration_minutes=60)  # ends well before

    s = scenario(
        tasks=(predecessor, successor),
        windows=(window_a, window_b),
        dependencies=(Dependency(predecessor_id="pred", successor_id="succ"),),
    )
    candidates = generate_candidates(s, ())
    successor_in_window_a = next(c for c in candidates if c.task_ids == ("succ",) and c.block_window_id == "w-a")
    # predecessor's window_b candidate ends before window_a starts, so the
    # successor's window_a candidate is feasible even though predecessor's
    # window_a candidate would not satisfy the ordering on its own.
    assert successor_in_window_a.feasible is True


def test_dependency_impossible_case_no_windows_at_all():
    predecessor = make_task("pred")
    successor = make_task("succ")
    s = scenario(tasks=(predecessor, successor), windows=(), dependencies=(Dependency(predecessor_id="pred", successor_id="succ"),))
    candidates = generate_candidates(s, ())
    assert candidates == []


def test_end_to_end_bundle_candidate_is_generated_and_feasible():
    eng = make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="TRACK_RENEWAL", estimated_duration_minutes=180)
    trd = make_task("trd-1", corridor_id="c1", department="TRD", work_type="OHE_MAINTENANCE", estimated_duration_minutes=120)
    window = make_window("w1", corridor_id="c1", duration_minutes=240)

    s = scenario(tasks=(eng, trd), windows=(window,))
    bundles = find_bundle_pairs(s.tasks, s.resources_by_id, s.compatibility_rules, DEFAULTS)
    assert len(bundles) == 1

    candidates = generate_candidates(s, bundles)
    bundle_candidates = [c for c in candidates if c.is_bundle]
    assert len(bundle_candidates) == 1
    assert bundle_candidates[0].feasible is True
    assert set(bundle_candidates[0].task_ids) == {"eng-1", "trd-1"}
    # Solo candidates for both tasks must also still exist (mutual exclusion
    # between solo and bundle is a solver-time concern, not a generation-time one).
    solo_ids = {c.task_ids for c in candidates if not c.is_bundle}
    assert ("eng-1",) in solo_ids
    assert ("trd-1",) in solo_ids
