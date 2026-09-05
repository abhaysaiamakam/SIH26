from src.impact import SIMULATION_ASSUMPTION_LABEL, run_simulation


def block(id="b1", corridor="c1", start="2026-09-10T01:00:00Z", end="2026-09-10T05:00:00Z", window_id="w1"):
    return {
        "blockWindowId": window_id,
        "corridorId": corridor,
        "startTime": start,
        "endTime": end,
        "isBundle": False,
        "department": "ENGINEERING",
        "taskIds": ["t1"],
    }


def window(id="w1", duration=240):
    return {
        "id": id,
        "corridorId": "c1",
        "segmentId": None,
        "startTime": "2026-09-10T01:00:00Z",
        "endTime": "2026-09-10T05:00:00Z",
        "durationMinutes": duration,
        "permittedDepartments": ["ENGINEERING"],
        "allowsIsolationTypes": ["NONE"],
        "allowsPowerTypes": ["NONE"],
        "maxConcurrentResources": None,
    }


def train(id="tm1", corridor="c1", train_type="GOODS", start="2026-09-10T01:30:00Z", end="2026-09-10T02:30:00Z"):
    return {
        "id": id,
        "trainNumber": "601",
        "trainType": train_type,
        "corridorId": corridor,
        "segmentId": None,
        "trackResourceId": None,
        "scheduledStart": start,
        "scheduledEnd": end,
        "priority": 3,
    }


def test_no_overlap_means_no_impact():
    result = run_simulation({"planBlocks": [block()], "blockWindows": [window()], "trainMovements": []})
    assert result["impactedTrainCount"] == 0
    assert result["totalDelayMinutes"] == 0
    assert result["conflicts"] == []


def test_goods_overlap_is_a_soft_conflict_with_delay():
    result = run_simulation({"planBlocks": [block()], "blockWindows": [window()], "trainMovements": [train()]})
    assert result["impactedTrainCount"] == 1
    assert result["totalDelayMinutes"] == 60
    assert result["conflicts"] == []
    assert "Soft conflict" in result["affectedMovements"][0]["reason"]


def test_passenger_overlap_is_a_hard_conflict():
    passenger = train(train_type="EXPRESS")
    result = run_simulation({"planBlocks": [block()], "blockWindows": [window()], "trainMovements": [passenger]})
    assert len(result["conflicts"]) == 1
    assert result["conflicts"][0]["code"] == "HARD_OPERATIONAL_CONFLICT"
    assert "Hard conflict" in result["affectedMovements"][0]["reason"]


def test_block_utilization_ratio():
    result = run_simulation({"planBlocks": [block()], "blockWindows": [window(duration=240)], "trainMovements": []})
    util = result["blockUtilization"][0]
    assert util["utilizedMinutes"] == 240
    assert util["windowMinutes"] == 240
    assert util["utilizationRatio"] == 1.0


def test_every_assumption_carries_the_required_label():
    result = run_simulation({"planBlocks": [], "blockWindows": [], "trainMovements": []})
    assert len(result["assumptions"]) > 0
    for assumption in result["assumptions"]:
        assert assumption.startswith(SIMULATION_ASSUMPTION_LABEL)


def test_different_corridor_train_never_impacts_a_block():
    other_corridor_train = train(corridor="c2")
    result = run_simulation({"planBlocks": [block(corridor="c1")], "blockWindows": [window()], "trainMovements": [other_corridor_train]})
    assert result["impactedTrainCount"] == 0
