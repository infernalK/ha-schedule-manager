"""Sensor platform for Schedule Manager."""

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType
from ..const import DOMAIN


async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    async_add_entities: AddEntitiesCallback,
    discovery_info: DiscoveryInfoType | None = None,
) -> None:
    """Set up the sensor platform."""
    coordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities([ScheduleManagerSensor(coordinator)])


class ScheduleManagerSensor(SensorEntity):
    """Representation of a Schedule Manager sensor."""

    def __init__(self, coordinator):
        """Initialize the sensor."""
        self._coordinator = coordinator
        self._attr_name = "Schedule Manager Status"
        self._attr_unique_id = f"{DOMAIN}_status"

    @property
    def state(self):
        """Return the state of the sensor."""
        data = self._coordinator.data
        if data and data.get("current_time_block"):
            return "active"
        return "idle"

    async def async_update(self) -> None:
        """Update the sensor."""
        await self._coordinator.async_request_refresh()