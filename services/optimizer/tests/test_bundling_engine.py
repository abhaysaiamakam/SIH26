from factories import make_task
from src.core.bundling_engine import find_bundle_pairs
from src.core.config_loader import load_compatibility_defaults


def defaults():
    return load_compatibility_defaults()


def test_finds_a_compatible_cross_department_same_corridor_pair():
    tasks = (
        make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="TRACK_RENEWAL"),
        make_task("trd-1", corridor_id="c1", department="TRD", work_type="OHE_MAINTENANCE"),
    )
    bundles = find_bundle_pairs(tasks, {}, (), defaults())
    assert len(bundles) == 1
    assert {bundles[0].task_a_id, bundles[0].task_b_id} == {"eng-1", "trd-1"}


def test_does_not_bundle_across_different_corridors():
    tasks = (
        make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="TRACK_RENEWAL"),
        make_task("trd-1", corridor_id="c2", department="TRD", work_type="OHE_MAINTENANCE"),
    )
    bundles = find_bundle_pairs(tasks, {}, (), defaults())
    assert bundles == ()


def test_does_not_bundle_incompatible_work_types():
    tasks = (
        make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="BRIDGE_INSPECTION"),
        make_task("eng-2", corridor_id="c1", department="ENGINEERING", work_type="BALLAST_CLEANING"),
    )
    bundles = find_bundle_pairs(tasks, {}, (), defaults())
    assert bundles == ()


def test_does_not_bundle_same_department_pairs_even_if_compatible():
    # Same-department work is sequenced by the department's own planner, not
    # "bundled" in the cross-department sense this engine targets.
    tasks = (
        make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="GENERAL_INSPECTION"),
        make_task("eng-2", corridor_id="c1", department="ENGINEERING", work_type="POINTS_CROSSING_MAINTENANCE"),
    )
    bundles = find_bundle_pairs(tasks, {}, (), defaults())
    assert bundles == ()


def test_finds_multiple_independent_pairs():
    tasks = (
        make_task("eng-1", corridor_id="c1", department="ENGINEERING", work_type="TRACK_RENEWAL"),
        make_task("trd-1", corridor_id="c1", department="TRD", work_type="OHE_MAINTENANCE"),
        make_task("eng-2", corridor_id="c2", department="ENGINEERING", work_type="POINTS_CROSSING_MAINTENANCE"),
        make_task("snt-1", corridor_id="c2", department="S_AND_T", work_type="INTERLOCKING_UPGRADE"),
    )
    bundles = find_bundle_pairs(tasks, {}, (), defaults())
    assert len(bundles) == 2
