"""Synchronise le nom affiché dans HA (appareil / entité) vers le stockage des plannings."""

from __future__ import annotations

import logging

from homeassistant.components import switch
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_registry import EVENT_ENTITY_REGISTRY_UPDATED

from .const import DOMAIN
from .services import async_persist
from .storage import ScheduleManagerStorage

_LOGGER = logging.getLogger(__name__)

_PLANNING_SWITCH_SUFFIX = "_planning"


def schedule_id_from_planning_unique_id(
    entry_id: str, unique_id: str | None
) -> str | None:
    """Extrait l'UUID planning depuis l'unique_id de l'interrupteur dédié."""
    if not unique_id:
        return None
    prefix = f"{entry_id}_"
    if not unique_id.startswith(prefix) or not unique_id.endswith(_PLANNING_SWITCH_SUFFIX):
        return None
    body = unique_id[len(prefix) : -len(_PLANNING_SWITCH_SUFFIX)]
    return body or None


def schedule_id_from_device_identifier(entry_id: str, identifier: str) -> str | None:
    """Extrait l'UUID planning depuis l'identifiant d'appareil (hors hub)."""
    prefix = f"{entry_id}_"
    if not identifier.startswith(prefix) or identifier == entry_id:
        return None
    body = identifier[len(prefix) :]
    return body or None


async def _apply_schedule_name(
    hass: HomeAssistant,
    storage: ScheduleManagerStorage,
    schedule_id: str,
    new_name: str,
) -> None:
    """Met à jour le stockage si le nom a changé, puis rafraîchit le capteur / la carte."""
    trimmed = new_name.strip()
    if not trimmed:
        return
    schedules = storage.get_schedules()
    sch = schedules.get(schedule_id)
    if sch is None or sch.name == trimmed:
        return
    sch.name = trimmed
    await async_persist(hass, storage)
    _LOGGER.debug(
        "%s: nom du planning %s synchronisé depuis le registre HA → %r",
        DOMAIN,
        schedule_id,
        trimmed,
    )


@callback
def async_setup_schedule_name_sync(
    hass: HomeAssistant, entry: ConfigEntry, storage: ScheduleManagerStorage
) -> None:
    """Écoute les renommages d'appareil / d'entité planning et met à jour le stockage."""
    entry_id = entry.entry_id

    @callback
    def _entity_registry_updated(event: Event) -> None:
        if event.data.get("action") != "update":
            return
        entity_id = event.data.get("entity_id")
        if not entity_id:
            return
        ent_reg = er.async_get(hass)
        entity = ent_reg.async_get(entity_id)
        if entity is None or entity.platform != DOMAIN:
            return
        if entity.domain != switch.DOMAIN:
            return
        schedule_id = schedule_id_from_planning_unique_id(entry_id, entity.unique_id)
        if schedule_id is None:
            return
        new_name = (entity.name or entity.original_name or "").strip()
        if not new_name:
            return
        hass.async_create_task(_apply_schedule_name(hass, storage, schedule_id, new_name))

    @callback
    def _device_registry_updated(event: Event) -> None:
        if event.data.get("action") != "update":
            return
        device_id = event.data.get("device_id")
        if not device_id:
            return
        dev_reg = dr.async_get(hass)
        device = dev_reg.async_get(device_id)
        if device is None:
            return
        schedule_id: str | None = None
        for domain, ident in device.identifiers:
            if domain != DOMAIN:
                continue
            schedule_id = schedule_id_from_device_identifier(entry_id, str(ident))
            if schedule_id is not None:
                break
        if schedule_id is None:
            return
        new_name = (device.name_by_user or device.name or "").strip()
        if not new_name:
            return
        hass.async_create_task(_apply_schedule_name(hass, storage, schedule_id, new_name))

    entry.async_on_unload(
        hass.bus.async_listen(EVENT_ENTITY_REGISTRY_UPDATED, _entity_registry_updated)
    )
    entry.async_on_unload(
        hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, _device_registry_updated)
    )
