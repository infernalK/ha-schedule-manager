"""Tests for Schedule Manager."""

import pytest
from custom_components.schedule_manager.models import Schedule, TimeBlock


def test_schedule_creation():
    schedule = Schedule(name="Test Schedule")
    assert schedule.name == "Test Schedule"
    assert schedule.enabled is True
    assert schedule.time_blocks == []


def test_time_block():
    block = TimeBlock(
        start_time="08:00",
        end_time="18:00",
        action_type="set_preset_mode",
        action_payload={"preset_mode": "home"}
    )
    assert block.start_time == "08:00"
    assert block.action_type == "set_preset_mode"