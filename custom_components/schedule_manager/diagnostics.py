"""Diagnostics for Schedule Manager."""

from typing import Any, Dict
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from .const import DOMAIN


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> Dict[str, Any]:
    """Return diagnostics for a config entry."""
    storage = hass.data[DOMAIN]["storage"]
    return {
        "schedules": storage.get_schedules(),
        "groups": storage.get_groups(),
        "overrides": storage.get_overrides(),
    }