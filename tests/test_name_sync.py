"""Tests for schedule name sync helpers."""

from custom_components.schedule_manager.name_sync import (
    schedule_id_from_device_identifier,
    schedule_id_from_planning_unique_id,
)


def test_schedule_id_from_planning_unique_id():
    entry_id = "abc123"
    sid = "plan-uuid-1"
    uid = f"{entry_id}_{sid}_planning"
    assert schedule_id_from_planning_unique_id(entry_id, uid) == sid
    assert schedule_id_from_planning_unique_id(entry_id, f"{entry_id}_planning") is None
    assert schedule_id_from_planning_unique_id(entry_id, "other_planning") is None


def test_schedule_id_from_device_identifier():
    entry_id = "abc123"
    sid = "plan-uuid-2"
    assert schedule_id_from_device_identifier(entry_id, f"{entry_id}_{sid}") == sid
    assert schedule_id_from_device_identifier(entry_id, entry_id) is None
    assert schedule_id_from_device_identifier(entry_id, "foreign") is None
