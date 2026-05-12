"""Switch platform for Schedule Manager."""

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .schedule_devices import async_setup_planning_switches


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the switch platform from a config entry."""
    coordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities([ScheduleManagerSwitch(coordinator, entry)])
    await async_setup_planning_switches(hass, entry, coordinator, async_add_entities)


class ScheduleManagerSwitch(SwitchEntity):
    """Representation of a Schedule Manager switch."""

    def __init__(self, coordinator, entry: ConfigEntry):
        """Initialize the switch."""
        self._coordinator = coordinator
        self._entry = entry
        self._attr_name = "Schedule Manager Enabled"
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_enabled"
        self._is_on = True

    @property
    def device_info(self) -> DeviceInfo:
        """Même appareil que le capteur d’état."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name="Schedule Manager",
            manufacturer="Schedule Manager",
            model="Hub",
        )

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
