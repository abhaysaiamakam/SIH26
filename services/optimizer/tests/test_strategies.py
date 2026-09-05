from datetime import timedelta

from factories import NOW, make_resource, make_task, make_window
from src.core.candidates import generate_candidates
from src.core.config_loader import (
    load_compatibility_defaults,
    load_objective_weights,
    load_priority_weights,
    load_solver_settings,
)
from src.core.models import NormalizedScenario, RequiredResource
from src.core.result import build_result
from src.strategies import first_feasible, priority_first
from src.strategies import optimized as optimized_strategy

PRIORITY_WEIGHTS = load_priority_weights()
OBJECTIVE_WEIGHTS = load_objective_weights()
SOLVER_SETTINGS = load_solver_settings()
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


def run_optimized(s, candidates):
    selected, status = optimized_strategy.run(s, candidates, PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS, SOLVER_SETTINGS, time_limit_seconds=5)
    return selected, status


def _resource_conflict_scenario():
    """Two tasks on different corridors compete for the same capacity-1
    machine, in fully overlapping windows - only one can ever be scheduled.
    Task B is far higher priority (critical + overdue) than task A."""
    resource = make_resource("machine-1", capacity=1)
    task_a = make_task(
        "a",
        corridor_id="c1",
        criticality="LOW",
        urgency="LOW",
        asset_criticality="LOW",
        due_date=NOW + timedelta(days=60),
        required_resources=(RequiredResource(resource_id="machine-1", quantity=1),),
    )
    task_b = make_task(
        "b",
        corridor_id="c2",
        criticality="CRITICAL",
        urgency="CRITICAL",
        asset_criticality="CRITICAL",
        due_date=NOW - timedelta(days=10),
        required_resources=(RequiredResource(resource_id="machine-1", quantity=1),),
    )
    window_a = make_window("w1", corridor_id="c1", start_time=NOW)
    window_b = make_window("w2", corridor_id="c2", start_time=NOW)
    s = scenario(tasks=(task_a, task_b), windows=(window_a, window_b), resources={"machine-1": resource})
    candidates = generate_candidates(s, ())
    return s, candidates


def test_first_feasible_is_deterministic_across_runs():
    s, candidates = _resource_conflict_scenario()
    result1 = first_feasible.run(s, candidates)
    result2 = first_feasible.run(s, candidates)
    assert result1 == result2


def test_priority_first_is_deterministic_across_runs():
    s, candidates = _resource_conflict_scenario()
    result1 = priority_first.run(s, candidates, PRIORITY_WEIGHTS)
    result2 = priority_first.run(s, candidates, PRIORITY_WEIGHTS)
    assert result1 == result2


def test_optimized_is_deterministic_across_runs():
    s, candidates = _resource_conflict_scenario()
    result1, _ = run_optimized(s, candidates)
    result2, _ = run_optimized(s, candidates)
    assert result1 == result2


def test_priority_first_picks_the_higher_priority_task_under_a_resource_conflict():
    s, candidates = _resource_conflict_scenario()
    selected = priority_first.run(s, candidates, PRIORITY_WEIGHTS)
    scheduled_tasks = {tid for cid in selected for c in candidates if c.id == cid for tid in c.task_ids}
    assert scheduled_tasks == {"b"}


def test_optimized_also_picks_the_higher_value_task_under_a_resource_conflict():
    s, candidates = _resource_conflict_scenario()
    selected, status = run_optimized(s, candidates)
    assert status in ("OPTIMAL", "FEASIBLE")
    scheduled_tasks = {tid for cid in selected for c in candidates if c.id == cid for tid in c.task_ids}
    assert scheduled_tasks == {"b"}


def test_strategies_can_visibly_diverge_on_a_scenario_with_two_competing_priorities():
    """A scenario deliberately shaped so that generation-order (FIRST_FEASIBLE)
    disagrees with priority order (PRIORITY_FIRST / OPTIMIZED)."""
    resource = make_resource("machine-1", capacity=1)
    low_priority_first_in_order = make_task(
        "low-first",
        corridor_id="c1",
        criticality="LOW",
        urgency="LOW",
        asset_criticality="LOW",
        due_date=NOW + timedelta(days=90),
        required_resources=(RequiredResource(resource_id="machine-1", quantity=1),),
    )
    high_priority_second_in_order = make_task(
        "high-second",
        corridor_id="c2",
        criticality="CRITICAL",
        urgency="CRITICAL",
        asset_criticality="CRITICAL",
        due_date=NOW - timedelta(days=15),
        required_resources=(RequiredResource(resource_id="machine-1", quantity=1),),
    )
    window_a = make_window("w1", corridor_id="c1", start_time=NOW)
    window_b = make_window("w2", corridor_id="c2", start_time=NOW)
    s = scenario(
        tasks=(low_priority_first_in_order, high_priority_second_in_order),
        windows=(window_a, window_b),
        resources={"machine-1": resource},
    )
    candidates = generate_candidates(s, ())

    first_feasible_selected = first_feasible.run(s, candidates)
    priority_first_selected = priority_first.run(s, candidates, PRIORITY_WEIGHTS)

    ff_tasks = {tid for cid in first_feasible_selected for c in candidates if c.id == cid for tid in c.task_ids}
    pf_tasks = {tid for cid in priority_first_selected for c in candidates if c.id == cid for tid in c.task_ids}

    assert ff_tasks == {"low-first"}
    assert pf_tasks == {"high-second"}
    assert ff_tasks != pf_tasks


def test_optimized_objective_is_never_worse_than_either_greedy_strategy():
    """CP-SAT solves the exact same ILP that any greedy selection is a
    feasible (if not necessarily optimal) solution to - so its objective
    must always be >= both greedy strategies', for any scenario."""
    s, candidates = _resource_conflict_scenario()

    ff_selected = first_feasible.run(s, candidates)
    pf_selected = priority_first.run(s, candidates, PRIORITY_WEIGHTS)
    opt_selected, _ = run_optimized(s, candidates)

    ff_result = build_result(s, candidates, ff_selected, PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)
    pf_result = build_result(s, candidates, pf_selected, PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)
    opt_result = build_result(s, candidates, opt_selected, PRIORITY_WEIGHTS, OBJECTIVE_WEIGHTS)

    epsilon = 0.01
    assert opt_result.objective_value >= ff_result.objective_value - epsilon
    assert opt_result.objective_value >= pf_result.objective_value - epsilon


def test_optimized_bundles_when_bundling_strictly_improves_the_objective():
    from src.core.bundling_engine import find_bundle_pairs

    eng = make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="TRACK_RENEWAL", estimated_duration_minutes=180)
    trd = make_task("trd-1", corridor_id="c1", department="TRD", work_type="OHE_MAINTENANCE", estimated_duration_minutes=120)
    window = make_window("w1", corridor_id="c1", duration_minutes=240)
    s = scenario(tasks=(eng, trd), windows=(window,))

    bundles = find_bundle_pairs(s.tasks, s.resources_by_id, s.compatibility_rules, DEFAULTS)
    candidates = generate_candidates(s, bundles)

    selected, status = run_optimized(s, candidates)
    assert status in ("OPTIMAL", "FEASIBLE")
    selected_candidates = [c for c in candidates if c.id in selected]
    assert len(selected_candidates) == 1
    assert selected_candidates[0].is_bundle is True


def test_a_task_with_no_feasible_candidates_is_never_selected_by_any_strategy():
    task = make_task("t1", estimated_duration_minutes=999)
    window = make_window("w1", duration_minutes=60)
    s = scenario(tasks=(task,), windows=(window,))
    candidates = generate_candidates(s, ())

    assert first_feasible.run(s, candidates) == set()
    assert priority_first.run(s, candidates, PRIORITY_WEIGHTS) == set()
    selected, _ = run_optimized(s, candidates)
    assert selected == set()
