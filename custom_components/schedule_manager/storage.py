"""Storage handling for Schedule Manager."""

from dataclasses import replace

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from typing import Any, Dict

from .const import STORAGE_KEY, STORAGE_VERSION
from .models import (
    Override,
    Schedule,
    override_from_dict,
    override_to_dict,
    schedule_from_dict,
    schedule_to_dict,
)


class ScheduleManagerStorage:
    """Handles storage for schedules and overrides."""

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
        base: Dict[str, Any] = {
            "schedules": {},
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

        overrides: Dict[str, Override] = {}
        for oid, item in raw.get("overrides", {}).items():
            if isinstance(item, Override):
                overrides[oid] = item
            else:
                overrides[oid] = override_from_dict(item)

        return {"schedules": schedules, "overrides": overrides}

    async def async_save(self) -> None:
        """Save data to storage as JSON-serializable dicts."""
        payload = {
            "schedules": {
                sid: schedule_to_dict(sch)
                for sid, sch in self.get_schedules().items()
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

    def get_overrides(self) -> Dict[str, Override]:
        """Get all overrides."""
        return self._data.get("overrides", {})

    def add_schedule(self, schedule: Schedule) -> None:
        """Add a schedule."""
        self._data["schedules"][schedule.id] = schedule

    def add_override(self, override: Override) -> None:
        """Add an override."""
        self._data["overrides"][override.id] = override

    def remove_schedule(self, schedule_id: str) -> None:
        """Remove a schedule."""
        if schedule_id in self._data["schedules"]:
            del self._data["schedules"][schedule_id]

    def remove_override(self, override_id: str) -> None:
        """Remove an override."""
        if override_id in self._data["overrides"]:
            del self._data["overrides"][override_id]
