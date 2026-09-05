from factories import make_resource, make_task
from src.core.compatibility_engine import check_compatibility
from src.core.config_loader import load_compatibility_defaults
from src.core.models import CompatibilityRule, RequiredResource


def defaults():
    return load_compatibility_defaults()


def test_cross_department_allow_list_pair_is_compatible():
    a = make_task("a", department="ENGINEERING", work_type="TRACK_RENEWAL")
    b = make_task("b", department="TRD", work_type="OHE_MAINTENANCE")
    result = check_compatibility(a, b, {}, (), defaults())
    assert result.compatible is True
    assert result.same_corridor is True
    assert result.work_types_compatible is True


def test_cross_department_pair_without_allow_list_entry_is_incompatible():
    a = make_task("a", department="ENGINEERING", work_type="BALLAST_CLEANING")
    b = make_task("b", department="S_AND_T", work_type="SIGNAL_MAINTENANCE")
    result = check_compatibility(a, b, {}, (), defaults())
    assert result.compatible is False


def test_hard_incompatible_pair_is_never_compatible_even_same_department():
    a = make_task("a", department="ENGINEERING", work_type="BRIDGE_INSPECTION")
    b = make_task("b", department="ENGINEERING", work_type="BALLAST_CLEANING")
    result = check_compatibility(a, b, {}, (), defaults())
    assert result.compatible is False
    assert "Hard incompatible" in " ".join(result.reasons)


def test_same_department_incompatible_pair():
    a = make_task("a", department="ENGINEERING", work_type="BALLAST_CLEANING")
    b = make_task("b", department="ENGINEERING", work_type="TRACK_RENEWAL")
    result = check_compatibility(a, b, {}, (), defaults())
    assert result.compatible is False


def test_same_department_default_compatible():
    a = make_task("a", department="ENGINEERING", work_type="GENERAL_INSPECTION")
    b = make_task("b", department="ENGINEERING", work_type="POINTS_CROSSING_MAINTENANCE")
    result = check_compatibility(a, b, {}, (), defaults())
    assert result.compatible is True


def test_different_corridors_are_never_compatible():
    a = make_task("a", corridor_id="c1", department="ENGINEERING", work_type="TRACK_RENEWAL")
    b = make_task("b", corridor_id="c2", department="TRD", work_type="OHE_MAINTENANCE")
    result = check_compatibility(a, b, {}, (), defaults())
    assert result.same_corridor is False
    assert result.compatible is False


def test_explicit_rule_overrides_default_to_true():
    a = make_task("a", department="ENGINEERING", work_type="RAIL_GRINDING")
    b = make_task("b", department="S_AND_T", work_type="SIGNAL_MAINTENANCE")
    # Default for this pair is incompatible (not in allow list) - confirm first.
    assert check_compatibility(a, b, {}, (), defaults()).compatible is False

    rule = CompatibilityRule(work_type_a="RAIL_GRINDING", work_type_b="SIGNAL_MAINTENANCE", department=None, compatible=True, reason="override")
    result = check_compatibility(a, b, {}, (rule,), defaults())
    assert result.compatible is True


def test_explicit_rule_overrides_default_to_false():
    a = make_task("a", department="ENGINEERING", work_type="GENERAL_INSPECTION")
    b = make_task("b", department="TRD", work_type="TRACK_RENEWAL")
    assert check_compatibility(a, b, {}, (), defaults()).compatible is True

    rule = CompatibilityRule(work_type_a="GENERAL_INSPECTION", work_type_b="TRACK_RENEWAL", department=None, compatible=False, reason="override")
    result = check_compatibility(a, b, {}, (rule,), defaults())
    assert result.compatible is False


def test_explicit_department_scoped_rule_only_applies_when_both_match():
    rule = CompatibilityRule(work_type_a="BALLAST_CLEANING", work_type_b="TRACK_RENEWAL", department="ENGINEERING", compatible=True, reason="scoped override")
    a_eng = make_task("a", department="ENGINEERING", work_type="BALLAST_CLEANING")
    b_eng = make_task("b", department="ENGINEERING", work_type="TRACK_RENEWAL")
    assert check_compatibility(a_eng, b_eng, {}, (rule,), defaults()).compatible is True

    # Same work types, but not both ENGINEERING - the scoped rule must not apply.
    b_other = make_task("b2", department="TRD", work_type="TRACK_RENEWAL")
    # TRACK_RENEWAL isn't a TRD work type in reality, but the compatibility
    # engine only cares about the department label recorded on the request.
    result = check_compatibility(a_eng, b_other, {}, (rule,), defaults())
    assert result.compatible is False  # falls through to hard-incompatible/default, not the scoped rule


def test_resource_conflict_when_combined_demand_exceeds_capacity():
    resource = make_resource("r1", capacity=1)
    a = make_task(
        "a",
        department="ENGINEERING",
        work_type="TRACK_RENEWAL",
        required_resources=(RequiredResource(resource_id="r1", quantity=1),),
    )
    b = make_task(
        "b",
        department="TRD",
        work_type="OHE_MAINTENANCE",
        required_resources=(RequiredResource(resource_id="r1", quantity=1),),
    )
    result = check_compatibility(a, b, {"r1": resource}, (), defaults())
    assert result.resource_conflict is True
    assert result.compatible is False


def test_no_resource_conflict_when_capacity_sufficient():
    resource = make_resource("r1", capacity=2)
    a = make_task(
        "a",
        department="ENGINEERING",
        work_type="TRACK_RENEWAL",
        required_resources=(RequiredResource(resource_id="r1", quantity=1),),
    )
    b = make_task(
        "b",
        department="TRD",
        work_type="OHE_MAINTENANCE",
        required_resources=(RequiredResource(resource_id="r1", quantity=1),),
    )
    result = check_compatibility(a, b, {"r1": resource}, (), defaults())
    assert result.resource_conflict is False
    assert result.compatible is True
