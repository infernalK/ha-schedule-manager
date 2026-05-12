"""Storage handling for Schedule Manager."""

from dataclasses import replace

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from typing import Any, Dict
from .const import STORAGE_KEY, STORAGE_VERSION
from .models import (
    Override,
    Schedule,
    ScheduleGroup,
    group_from_dict,
    group_to_dict,
    override_from_dict,
    override_to_dict,
    schedule_from_dict,
    schedule_to_dict,
)


class ScheduleManagerStorage:
    """Handles storage for schedules, groups, and overrides."""

    def __init__(self, hass: HomeAssistant):
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: Dict[str, Any] = {}

    async def async_load(self) -> Dict[str, Any]:
        """Load data from storage."""
        raw = await self._store.async_load() or {}
        self._data = self._deserialize(raw)
        return self._data

    def _deserialize(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Restore dataclass instances from persisted dict."""
        base = {
            "schedules": {},
            "groups": {},
            "overrides": {},
        }
        if not raw:
            return base

        schedules: Dict[str, Schedule] = {}
        for sid, item in raw.get("schedules", {}).items():
            if isinstance(item, Schedule):
                sch = item
            else:
                sch = schedule_from_dict(item)
            # La clé JSON doit être la référence unique ; un `id` interne divergent casse la carte / les services.
            if sch.id != sid:
                sch = replace(sch, id=sid)
            schedules[sid] = sch

        groups: Dict[str, ScheduleGroup] = {}
        for gid, item in raw.get("groups", {}).items():
            if isinstance(item, ScheduleGroup):
                grp = item
            else:
                grp = group_from_dict(item)
            filtered = [x for x in grp.schedules if x in schedules]
            active = grp.active_schedule
            if active is not None and active not in schedules:
                active = None
            if filtered != grp.schedules or active != grp.active_schedule:
                grp = replace(grp, schedules=filtered, active_schedule=active)
            groups[gid] = grp

        overrides: Dict[str, Override] = {}
        for oid, item in raw.get("overrides", {}).items():
            if isinstance(item, Override):
                overrides[oid] = item
            else:
                overrides[oid] = override_from_dict(item)

        return {"schedules": schedules, "groups": groups, "overrides": overrides}

    async def async_save(self) -> None:
        """Save data to storage as JSON-serializable dicts."""
        payload = {
            "schedules": {
                sid: schedule_to_dict(sch)
                for sid, sch in self.get_schedules().items()
            },
            "groups": {
                gid: group_to_dict(grp)
                for gid, grp in self.get_groups().items()
            },
            "overrides": {
                oid: override_to_dict(ovr)
                for oid, ovr in self.get_overrides().items()
            },
        }
        await self._store.async_save(payload)

    def get_schedules(self) -> Dict[str, Schedule]:
        """Get all schedules."""
        return self._data.get("schedules", {})

    def get_groups(self) -> Dict[str, ScheduleGroup]:
        """Get all groups."""
        return self._data.get("groups", {})

    def get_overrides(self) -> Dict[str, Override]:
        """Get all overrides."""
        return self._data.get("overrides", {})

    def add_schedule(self, schedule: Schedule) -> None:
        """Add a schedule."""
        self._data["schedules"][schedule.id] = schedule

    def add_group(self, group: ScheduleGroup) -> None:
        """Add a group."""
        self._data["groups"][group.id] = group

    def add_override(self, override: Override) -> None:
        """Add an override."""
        self._data["overrides"][override.id] = override

    def remove_schedule(self, schedule_id: str) -> None:
        """Remove a schedule."""
        if schedule_id in self._data["schedules"]:
            del self._data["schedules"][schedule_id]

    def detach_schedule_from_groups(self, schedule_id: str) -> None:
        """Retire un planning de toutes les listes de groupes (références + actif)."""
        groups = self._data.get("groups", {})
        for gid, grp in list(groups.items()):
            if schedule_id not in grp.schedules and grp.active_schedule != schedule_id:
                continue
            new_schedules = [x for x in grp.schedules if x != schedule_id]
            new_active = grp.active_schedule
            if new_active == schedule_id:
                new_active = None
            elif new_active is not None and new_active not in new_schedules:
                new_active = None
            groups[gid] = replace(
                grp, schedules=new_schedules, active_schedule=new_active
            )

    def remove_group(self, group_id: str) -> None:
        """Remove a group."""
        if group_id in self._data["groups"]:
            del self._data["groups"][group_id]

    def remove_override(self, override_id: str) -> None:
        """Remove an override."""
        if override_id in self._data["overrides"]:
            del self._data["overrides"][override_id]