"""Data coordinator for Schedule Manager."""

from datetime import datetime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from .const import DOMAIN
from .engine import ScheduleEngine
from .storage import ScheduleManagerStorage


class ScheduleManagerCoordinator(DataUpdateCoordinator):
    """Coordinator for Schedule Manager data."""

    def __init__(self, hass: HomeAssistant, storage: ScheduleManagerStorage):
        super().__init__(
            hass,
            logger=None,  # Add logger if needed
            name=DOMAIN,
            update_interval=None,  # Update on demand or periodically
        )
        self.storage = storage
        self.engine = ScheduleEngine()

    async def _async_update_data(self):
        """Update data."""
        current_time = datetime.now()
        schedules = self.storage.get_schedules()
        groups = self.storage.get_groups()

        current_block = self.engine.resolve_group_action(groups, schedules, current_time)

        return {
            "current_time_block": current_block,
            "schedules": schedules,
            "groups": groups,
        }