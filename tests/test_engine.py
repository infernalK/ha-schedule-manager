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


def test_resolve_active_slot_single_schedule():
    """Un seul planning : plage active attendue."""
    b = TimeBlock(
        start_time=time(9, 0),
        end_time=time(17, 0),
        actions=[BlockAction(action_type="light.turn_on", action_payload={"entity_id": "light.x"})],
    )
    schedules = {"a": _sch("a", [b])}
    now = datetime(2026, 5, 13, 12, 0, 0)  # mercredi
    assert now.weekday() == 2
    slot = ScheduleEngine.resolve_active_slot(schedules, now)
    assert slot is not None
    assert slot.schedule_id == "a"
    assert slot.block.start_time == time(9, 0)


def test_resolve_active_slot_latest_start_wins_across_schedules():
    """Plusieurs plannings : début de plage le plus tardif seul dans le lot d’exécution."""
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
    now = datetime(2026, 5, 13, 11, 0, 0)
    slot = ScheduleEngine.resolve_active_slot(schedules, now)
    assert slot is not None
    assert slot.schedule_id == "narrow"
    assert slot.block.id == "bn"
    slots = ScheduleEngine.resolve_active_slots_for_execution(schedules, now)
    assert len(slots) == 1
    assert slots[0].schedule_id == "narrow"


def test_resolve_active_slots_same_start_two_schedules():
    """Deux plannings avec plage démarrée à la même heure : les deux sont à exécuter."""
    b1 = TimeBlock(
        time(7, 0),
        time(9, 0),
        [BlockAction("light.turn_on", {}, id="1")],
        id="b1",
    )
    b2 = TimeBlock(
        time(7, 0),
        time(9, 0),
        [BlockAction("switch.turn_on", {}, id="2")],
        id="b2",
    )
    schedules = {"a": _sch("a", [b1]), "z_second": _sch("z_second", [b2])}
    now = datetime(2026, 5, 13, 7, 30, 0)
    slots = ScheduleEngine.resolve_active_slots_for_execution(schedules, now)
    assert len(slots) == 2
    assert [s.schedule_id for s in slots] == ["a", "z_second"]


def test_resolve_active_slots_only_latest_start_among_active():
    """Plage 6h–12h et 7h–9h à 7h30 : seule la plage commencée à 7h est dans le lot."""
    b_early = TimeBlock(
        time(6, 0),
        time(12, 0),
        [BlockAction("light.turn_on", {}, id="e")],
        id="early",
    )
    b_late = TimeBlock(
        time(7, 0),
        time(9, 0),
        [BlockAction("switch.turn_on", {}, id="l")],
        id="late",
    )
    schedules = {
        "early_s": _sch("early_s", [b_early]),
        "late_s": _sch("late_s", [b_late]),
    }
    now = datetime(2026, 5, 13, 7, 30, 0)
    slots = ScheduleEngine.resolve_active_slots_for_execution(schedules, now)
    assert len(slots) == 1
    assert slots[0].schedule_id == "late_s"


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
    nxt = ScheduleEngine.compute_next_schedule_event(schedules, now)
    assert nxt == datetime(2026, 5, 13, 17, 0, 0, tzinfo=timezone.utc)


def test_disabled_schedule_excluded_from_execution():
    """Planning désactivé : aucune plage retournée pour l’exécution."""
    b = TimeBlock(
        time(9, 0),
        time(17, 0),
        [BlockAction("light.turn_on", {}, id="a")],
        id="b",
    )
    schedules = {"off": _sch("off", [b], enabled=False)}
    now = datetime(2026, 5, 13, 12, 0, 0)
    assert ScheduleEngine.resolve_active_slots_for_execution(schedules, now) == []
    assert ScheduleEngine.get_current_time_block(schedules["off"], now) is None


def test_resolve_slot_for_newly_enabled_schedule_when_not_in_batch():
    """Réactivation : plage couvrant l’instant mais début plus tôt qu’un autre planning actif."""
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
    now = datetime(2026, 5, 13, 11, 0, 0)
    batch = ScheduleEngine.resolve_active_slots_for_execution(schedules, now)
    assert len(batch) == 1
    assert batch[0].schedule_id == "narrow"

    slot = ScheduleEngine.resolve_slot_for_newly_enabled_schedule(
        schedules, "wide", now
    )
    assert slot is not None
    assert slot.schedule_id == "wide"
    assert slot.block.id == "bw"


def test_resolve_slot_for_newly_enabled_schedule_skips_when_in_batch():
    """Si le planning est déjà dans le lot coordinateur, pas d’exécution redondante."""
    b = TimeBlock(
        time(9, 0),
        time(17, 0),
        [BlockAction("light.turn_on", {}, id="a")],
        id="b",
    )
    schedules = {"solo": _sch("solo", [b])}
    now = datetime(2026, 5, 13, 12, 0, 0)
    assert (
        ScheduleEngine.resolve_slot_for_newly_enabled_schedule(
            schedules, "solo", now
        )
        is None
    )


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
