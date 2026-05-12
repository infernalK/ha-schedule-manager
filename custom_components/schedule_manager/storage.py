"""Storage handling for Schedule Manager."""

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from typing import Dict, Any
from .const import STORAGE_KEY, STORAGE_VERSION
from .models import Schedule, ScheduleGroup, Override


class ScheduleManagerStorage:
    """Handles storage for schedules, groups, and overrides."""

    def __init__(self, hass: HomeAssistant):
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: Dict[str, Any] = {}

    async def async_load(self) -> Dict[str, Any]:
        """Load data from storage."""
        self._data = await self._store.async_load() or {
            "schedules": {},
            "groups": {},
            "overrides": {}
        }
        return self._data

    async def async_save(self) -> None:
        """Save data to storage."""
        await self._store.async_save(self._data)

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

    def remove_group(self, group_id: str) -> None:
        """Remove a group."""
        if group_id in self._data["groups"]:
            del self._data["groups"][group_id]

    def remove_override(self, override_id: str) -> None:
        """Remove an override."""
        if override_id in self._data["overrides"]:
            del self._data["overrides"][override_id]