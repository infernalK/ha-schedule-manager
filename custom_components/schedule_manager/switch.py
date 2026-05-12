"""Switch platform for Schedule Manager."""

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the switch platform from a config entry."""
    coordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities([ScheduleManagerSwitch(coordinator)])


class ScheduleManagerSwitch(SwitchEntity):
    """Representation of a Schedule Manager switch."""

    def __init__(self, coordinator):
        """Initialize the switch."""
        self._coordinator = coordinator
        self._attr_name = "Schedule Manager Enabled"
        self._attr_unique_id = f"{DOMAIN}_enabled"
        self._is_on = True

    @property
    def is_on(self):
        """Return true if the switch is on."""
        return self._is_on

    async def async_turn_on(self, **kwargs):
        """Turn the switch on."""
        self._is_on = True

    async def async_turn_off(self, **kwargs):
        """Turn the switch off."""
        self._is_on = False
