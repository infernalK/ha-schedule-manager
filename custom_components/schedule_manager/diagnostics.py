"""Diagnostics for Schedule Manager."""

from typing import Any, Dict
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from .const import DOMAIN
from .models import override_to_dict, schedule_to_dict


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> Dict[str, Any]:
    """Return diagnostics for a config entry."""
    storage = hass.data[DOMAIN]["storage"]
    return {
        "schedules": {
            sid: schedule_to_dict(sch) for sid, sch in storage.get_schedules().items()
        },
        "overrides": {
            oid: override_to_dict(ovr) for oid, ovr in storage.get_overrides().items()
        },
    }