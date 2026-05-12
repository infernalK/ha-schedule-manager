"""Tests for Schedule Manager."""

from datetime import time

from custom_components.schedule_manager.models import Schedule, TimeBlock


def test_schedule_creation():
    schedule = Schedule(name="Test Schedule")
    assert schedule.name == "Test Schedule"
    assert schedule.enabled is True
    assert schedule.time_blocks == []


def test_time_block():
    block = TimeBlock(
        start_time=time(8, 0),
        end_time=time(18, 0),
        action_type="set_preset_mode",
        action_payload={"preset_mode": "home"},
    )
    assert block.start_time == time(8, 0)
    assert block.action_type == "set_preset_mode"