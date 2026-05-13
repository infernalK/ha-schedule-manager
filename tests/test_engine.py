"""Tests du moteur de plages (sans instance Home Assistant)."""

from __future__ import annotations

import importlib.util
import sys
import types
from datetime import datetime, time, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_SM_DIR = _ROOT / "custom_components" / "schedule_manager"
_MODELS_PATH = _SM_DIR / "models.py"
_ENGINE_PATH = _SM_DIR / "engine.py"

_pkg = types.ModuleType("schedule_manager")
_pkg.__path__ = [str(_SM_DIR)]
sys.modules["schedule_manager"] = _pkg

_spec_m = importlib.util.spec_from_file_location("schedule_manager.models", _MODELS_PATH)
assert _spec_m and _spec_m.loader
_mod_m = importlib.util.module_from_spec(_spec_m)
sys.modules["schedule_manager.models"] = _mod_m
_spec_m.loader.exec_module(_mod_m)

_spec_e = importlib.util.spec_from_file_location("schedule_manager.engine", _ENGINE_PATH)
assert _spec_e and _spec_e.loader
_mod_e = importlib.util.module_from_spec(_spec_e)
sys.modules["schedule_manager.engine"] = _mod_e
_spec_e.loader.exec_module(_mod_e)

ScheduleEngine = _mod_e.ScheduleEngine
BlockAction = _mod_m.BlockAction
Schedule = _mod_m.Schedule
ScheduleGroup = _mod_m.ScheduleGroup
TimeBlock = _mod_m.TimeBlock


def _sch(
    sid: str,
    blocks: list,
    repeat_days=None,
    enabled: bool = True,
):
    return Schedule(
        name="S",
        id=sid,
        time_blocks=blocks,
        repeat_days=repeat_days if repeat_days is not None else list(range(7)),
        enabled=enabled,
    )


def test_resolve_orphan_schedules_without_groups():
    """Sans groupe en stockage, un planning seul doit quand même produire une plage active."""
    b = TimeBlock(
        start_time=time(9, 0),
        end_time=time(17, 0),
        actions=[BlockAction(action_type="light.turn_on", action_payload={"entity_id": "light.x"})],
    )
    schedules = {"a": _sch("a", [b])}
    now = datetime(2026, 5, 13, 12, 0, 0)  # mercredi
    assert now.weekday() == 2
    block = ScheduleEngine.resolve_group_action({}, schedules, now)
    assert block is not None
    assert block.schedule_id == "a"
    assert block.block.start_time == time(9, 0)


def test_exclusive_group_active_schedule_none_still_matches():
    """Groupe exclusif sans planning actif choisi : ne plus tout exclure (None != id)."""
    b = TimeBlock(
        start_time=time(10, 0),
        end_time=time(12, 0),
        actions=[BlockAction(action_type="switch.turn_on", action_payload={"entity_id": "switch.x"})],
    )
    schedules = {"s1": _sch("s1", [b])}
    groups = {
        "g1": ScheduleGroup(
            name="G",
            id="g1",
            schedules=["s1"],
            exclusive=True,
            active_schedule=None,
        )
    }
    now = datetime(2026, 5, 13, 11, 0, 0)
    block = ScheduleEngine.resolve_group_action(groups, schedules, now)
    assert block is not None
    assert block.schedule_id == "s1"


def test_overnight_block():
    b = TimeBlock(start_time=time(22, 0), end_time=time(6, 0), actions=[])
    sch = _sch("n", [b])
    t1 = datetime(2026, 5, 13, 23, 30, 0)
    assert ScheduleEngine.get_current_time_block(sch, t1) == b
    t2 = datetime(2026, 5, 13, 5, 30, 0)
    assert ScheduleEngine.get_current_time_block(sch, t2) == b
    t3 = datetime(2026, 5, 13, 12, 0, 0)
    assert ScheduleEngine.get_current_time_block(sch, t3) is None


def test_compute_next_schedule_event():
    """Prochaine borne = fin de plage le même jour si on est dans le créneau."""
    b = TimeBlock(start_time=time(9, 0), end_time=time(17, 0), actions=[])
    schedules = {"a": _sch("a", [b], repeat_days=[2])}
    now = datetime(2026, 5, 13, 12, 0, 0, tzinfo=timezone.utc)
    assert now.weekday() == 2
    nxt = ScheduleEngine.compute_next_schedule_event({}, schedules, now)
    assert nxt == datetime(2026, 5, 13, 17, 0, 0, tzinfo=timezone.utc)


def test_get_current_time_block_max_start_wins_on_overlap():
    """Chevauchement : le créneau actif = début le plus tardif (indépendant de l’ordre en JSON)."""
    b_wide = TimeBlock(
        time(8, 0),
        time(14, 0),
        [BlockAction("light.turn_on", {}, id="a1")],
        id="wide",
    )
    b_narrow = TimeBlock(
        time(10, 0),
        time(12, 0),
        [BlockAction("switch.turn_on", {}, id="a2")],
        id="narrow",
    )
    now = datetime(2026, 5, 13, 11, 0, 0)
    sch_wide_first = _sch("x", [b_wide, b_narrow])
    assert ScheduleEngine.get_current_time_block(sch_wide_first, now) == b_narrow
    sch_narrow_first = _sch("x", [b_narrow, b_wide])
    assert ScheduleEngine.get_current_time_block(sch_narrow_first, now) == b_narrow


def test_resolve_group_latest_start_wins():
    """Plusieurs plannings actifs dans un groupe : début de plage le plus tardif gagne."""
    wide = TimeBlock(
        time(8, 0),
        time(17, 0),
        [BlockAction("light.turn_on", {}, id="w")],
        id="bw",
    )
    narrow = TimeBlock(
        time(10, 0),
        time(12, 0),
        [BlockAction("switch.turn_on", {}, id="n")],
        id="bn",
    )
    schedules = {
        "wide": _sch("wide", [wide]),
        "narrow": _sch("narrow", [narrow]),
    }
    groups = {
        "g1": ScheduleGroup(
            name="G",
            id="g1",
            schedules=["wide", "narrow"],
            exclusive=False,
            active_schedule=None,
        )
    }
    now = datetime(2026, 5, 13, 11, 0, 0)
    slot = ScheduleEngine.resolve_group_action(groups, schedules, now)
    assert slot is not None
    assert slot.schedule_id == "narrow"
    assert slot.block.id == "bn"
