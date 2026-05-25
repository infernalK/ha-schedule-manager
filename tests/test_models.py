"""Tests for Schedule Manager models (chargement direct sans Home Assistant)."""

import importlib.util
from datetime import time
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_MODELS = _ROOT / "custom_components" / "schedule_manager" / "models.py"
_spec = importlib.util.spec_from_file_location("sm_models", _MODELS)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

BlockAction = _mod.BlockAction
Schedule = _mod.Schedule
TimeBlock = _mod.TimeBlock
schedule_from_dict = _mod.schedule_from_dict
time_block_from_dict = _mod.time_block_from_dict
time_block_to_dict = _mod.time_block_to_dict


def test_schedule_creation():
    schedule = Schedule(name="Test Schedule")
    assert schedule.name == "Test Schedule"
    assert schedule.enabled is True
    assert schedule.time_blocks == []


def test_time_block_actions():
    block = TimeBlock(
        start_time=time(8, 0),
        end_time=time(18, 0),
        actions=[
            BlockAction(
                action_type="climate.set_preset_mode",
                action_payload={"preset_mode": "home"},
            )
        ],
    )
    assert block.start_time == time(8, 0)
    assert block.actions[0].action_type == "climate.set_preset_mode"


def test_schedule_enabled_coerced_from_storage():
    """``enabled: false`` en JSON ne doit pas rester truthy (chaîne)."""
    sch = schedule_from_dict(
        {
            "id": "x",
            "name": "Off",
            "enabled": "false",
            "time_blocks": [],
        }
    )
    assert sch.enabled is False


def test_time_block_legacy_dict_migration():
    raw = {
        "start_time": "08:00:00",
        "end_time": "18:00:00",
        "action_type": "light.turn_on",
        "action_payload": {"entity_id": "light.x"},
    }
    block = time_block_from_dict(raw)
    assert len(block.actions) == 1
    assert block.actions[0].action_type == "light.turn_on"
    assert block.actions[0].action_payload["entity_id"] == "light.x"


def test_time_block_round_trip_actions():
    block = TimeBlock(
        start_time=time(8, 0),
        end_time=time(12, 0),
        actions=[
            BlockAction(action_type="a.turn_on", action_payload={"entity_id": "light.a"}),
            BlockAction(action_type="b.turn_off", action_payload={"entity_id": "switch.b"}),
        ],
        id="blk1",
    )
    d = time_block_to_dict(block)
    assert d is not None
    assert len(d["actions"]) == 2
    back = time_block_from_dict(d)
    assert len(back.actions) == 2
    assert back.actions[1].action_type == "b.turn_off"
