from datetime import timedelta

from factories import NOW, make_resource, make_task, make_window
from src.core.candidates import generate_candidates
from src.core.config_loader import load_objective_weights, load_priority_weights
from src.core.models import Dependency, NormalizedScenario, RequiredResource
from src.core.result import build_result

PRIORITY_WEIGHTS = load_priority_weights()
OBJECTIVE_WEIGHTS = load_objective_weights()


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


def test_scheduled_overdue_task_is_a_positive_outcome():
    task = make_task("t1", due_date=NOW - timedelta(days=5), criticality="CRITICAL", asset_criticality="CRITICAL")
    window = make_window("w1")
    s = scenario(tasks=(task,), windows=(window,))
    candidates = generate_candidates(s, ())
    selected = {c.id for c in candidates if c.feasible}
    result = build_result(s, candidates, selected, PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)
    assert result.objective_value > 0
    outcome = next(o for o in result.task_outcomes if o.maintenance_request_id == "t1")
    assert outcome.scheduled is True
    assert outcome.priority_breakdown["overdue"] > 0


def test_unscheduled_overdue_task_never_makes_the_objective_negative():
    """CRITICAL RULE: overdue + unscheduled must never subtract from the
    objective - it should simply contribute nothing, exactly like an
    unscheduled on-time task would."""
    overdue_task = make_task("overdue", due_date=NOW - timedelta(days=20), criticality="CRITICAL", asset_criticality="CRITICAL")
    on_time_task = make_task("on-time", due_date=NOW + timedelta(days=20), criticality="CRITICAL", asset_criticality="CRITICAL")

    # No windows at all - neither task can ever be scheduled.
    s_overdue = scenario(tasks=(overdue_task,), windows=())
    s_on_time = scenario(tasks=(on_time_task,), windows=())

    candidates_overdue = generate_candidates(s_overdue, ())
    candidates_on_time = generate_candidates(s_on_time, ())

    result_overdue = build_result(s_overdue, candidates_overdue, set(), PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)
    result_on_time = build_result(s_on_time, candidates_on_time, set(), PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)

    assert result_overdue.objective_value == 0
    assert result_overdue.objective_value == result_on_time.objective_value
    outcome = result_overdue.task_outcomes[0]
    assert outcome.scheduled is False


def test_bundled_pair_produces_one_plan_block_with_both_tasks():
    eng = make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="TRACK_RENEWAL", estimated_duration_minutes=180)
    trd = make_task("trd-1", corridor_id="c1", department="TRD", work_type="OHE_MAINTENANCE", estimated_duration_minutes=120)
    window = make_window("w1", corridor_id="c1", duration_minutes=240)
    s = scenario(tasks=(eng, trd), windows=(window,))

    from src.core.bundling_engine import find_bundle_pairs
    from src.core.config_loader import load_compatibility_defaults

    bundles = find_bundle_pairs(s.tasks, s.resources_by_id, s.compatibility_rules, load_compatibility_defaults())
    candidates = generate_candidates(s, bundles)
    bundle_candidate = next(c for c in candidates if c.is_bundle)

    result = build_result(s, candidates, {bundle_candidate.id}, PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)
    assert len(result.plan_blocks) == 1
    assert set(result.plan_blocks[0].task_ids) == {"eng-1", "trd-1"}
    assert result.plan_blocks[0].is_bundle is True
    for outcome in result.task_outcomes:
        assert outcome.scheduled is True
        assert any("Bundled with" in r for r in outcome.reasons)


def test_rejected_task_explanation_names_the_dominant_reason():
    task = make_task("t1", required_isolation="POWER_ISOLATION")
    window = make_window("w1", allows_isolation_types=("TRACK_ISOLATION",))
    s = scenario(tasks=(task,), windows=(window,))
    candidates = generate_candidates(s, ())
    result = build_result(s, candidates, set(), PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)
    outcome = result.task_outcomes[0]
    assert outcome.scheduled is False
    assert outcome.rejection_reason == "ISOLATION_MISMATCH"
    assert "ISOLATION_MISMATCH" in outcome.reasons[0]
