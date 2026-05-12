"""Sensor platform for Schedule Manager."""

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ScheduleManagerCoordinator
from .models import group_to_dict, schedule_to_dict, time_block_to_dict


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the sensor platform from a config entry."""
    coordinator: ScheduleManagerCoordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities([ScheduleManagerSensor(coordinator)])


class ScheduleManagerSensor(CoordinatorEntity, SensorEntity):
    """Representation of a Schedule Manager sensor."""

    def __init__(self, coordinator: ScheduleManagerCoordinator) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_name = "Schedule Manager Status"
        self._attr_unique_id = f"{DOMAIN}_status"

    @property
    def native_value(self):
        """Return the state of the sensor."""
        data = self.coordinator.data
        if data and data.get("current_time_block"):
            return "active"
        return "idle"

    @property
    def extra_state_attributes(self):
        """Expose schedules and groups for Lovelace cards."""
        storage = self.coordinator.storage
        schedules = storage.get_schedules()
        groups = storage.get_groups()
        current = None
        if self.coordinator.data:
            current = self.coordinator.data.get("current_time_block")
        return {
            "schedules": {sid: schedule_to_dict(s) for sid, s in schedules.items()},
            "groups": {gid: group_to_dict(g) for gid, g in groups.items()},
            "current_time_block": time_block_to_dict(current) if current else None,
        }
