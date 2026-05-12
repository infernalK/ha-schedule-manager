"""Switch platform for Schedule Manager."""

from homeassistant.components.switch import SwitchEntity
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
    """Set up the switch platform."""
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

    async def async_update(self) -> None:
        """Update the switch."""
        pass