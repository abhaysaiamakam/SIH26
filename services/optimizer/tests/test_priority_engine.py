from datetime import timedelta

from factories import NOW, make_task
from src.core.config_loader import load_priority_weights
from src.core.priority_engine import compute_priority


def weights():
    return load_priority_weights()


def test_breakdown_components_sum_to_total():
    task = make_task("t1", asset_criticality="HIGH", criticality="HIGH", urgency="MEDIUM", due_date=NOW + timedelta(days=20))
    result = compute_priority(task, NOW, weights())
    b = result.breakdown
    assert b.asset_criticality + b.maintenance_criticality + b.urgency + b.overdue + b.due_soon == b.total
    assert result.score == b.total


def test_overdue_adds_a_positive_bonus_never_a_penalty():
    on_time = make_task("t1", due_date=NOW + timedelta(days=20))
    overdue = make_task("t2", due_date=NOW - timedelta(days=5))
    on_time_result = compute_priority(on_time, NOW, weights())
    overdue_result = compute_priority(overdue, NOW, weights())

    assert overdue_result.is_overdue is True
    assert overdue_result.breakdown.overdue > 0
    # The only difference between these two tasks is the due date direction,
    # so the overdue task's score must be strictly higher - overdue can only
    # ever add, never subtract.
    assert overdue_result.score > on_time_result.score


def test_more_overdue_days_never_decreases_the_score():
    slightly_overdue = make_task("t1", due_date=NOW - timedelta(days=1))
    very_overdue = make_task("t2", due_date=NOW - timedelta(days=30))
    slightly_result = compute_priority(slightly_overdue, NOW, weights())
    very_result = compute_priority(very_overdue, NOW, weights())
    assert very_result.score >= slightly_result.score


def test_due_soon_bonus_only_applies_when_not_overdue():
    due_soon = make_task("t1", due_date=NOW + timedelta(days=2))
    result = compute_priority(due_soon, NOW, weights())
    assert result.is_overdue is False
    assert result.breakdown.due_soon > 0
    assert result.breakdown.overdue == 0


def test_critical_asset_and_maintenance_criticality_increase_score():
    low = make_task("t1", asset_criticality="LOW", criticality="LOW", urgency="LOW", due_date=NOW + timedelta(days=60))
    critical = make_task("t2", asset_criticality="CRITICAL", criticality="CRITICAL", urgency="CRITICAL", due_date=NOW + timedelta(days=60))
    low_result = compute_priority(low, NOW, weights())
    critical_result = compute_priority(critical, NOW, weights())
    assert critical_result.score > low_result.score


def test_explanation_mentions_overdue_and_criticality():
    task = make_task("t1", asset_criticality="CRITICAL", due_date=NOW - timedelta(days=6))
    result = compute_priority(task, NOW, weights())
    joined = " ".join(result.explanation)
    assert "Overdue" in joined
    assert "Critical" in joined
