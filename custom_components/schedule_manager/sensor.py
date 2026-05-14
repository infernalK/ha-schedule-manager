"""Sensor platform for Schedule Manager."""

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ScheduleManagerCoordinator
from .models import schedule_to_dict, time_block_to_dict


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the sensor platform from a config entry."""
    coordinator: ScheduleManagerCoordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities([ScheduleManagerSensor(coordinator, entry)])


class ScheduleManagerSensor(CoordinatorEntity, SensorEntity):
    """Representation of a Schedule Manager sensor."""

    def __init__(
        self, coordinator: ScheduleManagerCoordinator, entry: ConfigEntry
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._entry = entry
        self._attr_translation_key = "hub_status"
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_status"

    @property
    def device_info(self) -> DeviceInfo:
        """Regroupe capteur et commutateur sous un même appareil logique."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            manufacturer="Schedule Manager",
            translation_key="hub",
        )

    @property
    def native_value(self):
        """Return the state of the sensor."""
        data = self.coordinator.data
        if data and data.get("current_time_block"):
            return "active"
        return "idle"

    @property
    def extra_state_attributes(self):
        """Expose les plannings pour les cartes Lovelace."""
        storage = self.coordinator.storage
        schedules = storage.get_schedules()
        current = None
        active_schedule_id = None
        if self.coordinator.data:
            current = self.coordinator.data.get("current_time_block")
            slot = self.coordinator.data.get("active_time_slot")
            if slot is not None:
                active_schedule_id = slot.schedule_id
        return {
            "schedules": {sid: schedule_to_dict(s) for sid, s in schedules.items()},
            "active_schedule_id": active_schedule_id,
            "next_trigger": self.coordinator.data.get("next_trigger")
            if self.coordinator.data
            else None,
            "current_time_block": time_block_to_dict(current) if current else None,
        }
