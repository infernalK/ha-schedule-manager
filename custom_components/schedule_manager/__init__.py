"""Schedule Manager integration for Home Assistant."""

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from .const import DOMAIN, PLATFORMS
from .storage import ScheduleManagerStorage
from .coordinator import ScheduleManagerCoordinator
from .services import async_setup_services


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Schedule Manager from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Initialize storage
    storage = ScheduleManagerStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN]["storage"] = storage

    # Initialize coordinator
    coordinator = ScheduleManagerCoordinator(hass, storage)
    await coordinator.async_config_entry_first_refresh()
    hass.data[DOMAIN]["coordinator"] = coordinator

    # Set up services
    await async_setup_services(hass, storage)

    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop("storage", None)
        hass.data[DOMAIN].pop("coordinator", None)
    return unload_ok