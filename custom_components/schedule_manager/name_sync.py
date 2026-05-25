"""Synchronise les noms planning entre stockage, registre HA et carte Lovelace."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from homeassistant.components import switch
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_registry import EVENT_ENTITY_REGISTRY_UPDATED

from .const import DOMAIN
from .storage import ScheduleManagerStorage

if TYPE_CHECKING:
    from .schedule_devices import SchedulePlanningRegistry

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


def _planning_device_identifier(entry_id: str, schedule_id: str) -> set[tuple[str, str]]:
    return {(DOMAIN, f"{entry_id}_{schedule_id}")}


def _display_name_from_registry(
    entity: er.RegistryEntry | None,
    device: dr.DeviceEntry | None,
) -> str:
    """Nom affiché choisi par l'utilisateur (entité ou appareil)."""
    if entity is not None and entity.name:
        return entity.name.strip()
    if device is not None and device.name_by_user:
        return device.name_by_user.strip()
    if device is not None and device.name:
        return device.name.strip()
    if entity is not None and entity.original_name:
        return entity.original_name.strip()
    return ""


async def async_sync_schedule_display_name_from_storage(
    hass: HomeAssistant,
    entry_id: str,
    schedule_id: str,
    name: str,
) -> None:
    """Pousse le nom du stockage vers l'appareil planning (sans écraser inutilement)."""
    trimmed = name.strip()
    if not trimmed:
        return
    dev_reg = dr.async_get(hass)
    device = dev_reg.async_get_device(_planning_device_identifier(entry_id, schedule_id))
    if device is None:
        return
    current = (device.name_by_user or device.name or "").strip()
    if current == trimmed:
        return
    dev_reg.async_update_device(device.id, name_by_user=trimmed)


async def _refresh_planning_entity(
    hass: HomeAssistant, schedule_id: str
) -> None:
    registry: SchedulePlanningRegistry | None = hass.data.get(DOMAIN, {}).get(
        "schedule_planning_registry"
    )
    if registry is not None:
        await registry.async_refresh_schedule_attrs(schedule_id)


async def _apply_schedule_name(
    hass: HomeAssistant,
    storage: ScheduleManagerStorage,
    entry_id: str,
    schedule_id: str,
    new_name: str,
) -> None:
    """Met à jour le stockage si le nom a changé, puis rafraîchit capteur / carte."""
    trimmed = new_name.strip()
    if not trimmed:
        return
    schedules = storage.get_schedules()
    sch = schedules.get(schedule_id)
    if sch is None or sch.name == trimmed:
        return
    sch.name = trimmed
    from .services import async_persist

    await async_persist(hass, storage)
    await _refresh_planning_entity(hass, schedule_id)
    _LOGGER.debug(
        "%s: nom du planning %s synchronisé depuis le registre HA → %r",
        DOMAIN,
        schedule_id,
        trimmed,
    )


async def async_apply_schedule_name_from_storage(
    hass: HomeAssistant,
    entry_id: str,
    schedule_id: str,
    name: str,
) -> None:
    """Après modification du stockage (service update_schedule) : registre + entités."""
    await async_sync_schedule_display_name_from_storage(
        hass, entry_id, schedule_id, name
    )
    await _refresh_planning_entity(hass, schedule_id)


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
        dev_reg = dr.async_get(hass)
        device = (
            dev_reg.async_get(entity.device_id) if entity.device_id else None
        )
        new_name = _display_name_from_registry(entity, device)
        if not new_name:
            return
        hass.async_create_task(
            _apply_schedule_name(hass, storage, entry_id, schedule_id, new_name)
        )

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
        hass.async_create_task(
            _apply_schedule_name(hass, storage, entry_id, schedule_id, new_name)
        )

    entry.async_on_unload(
        hass.bus.async_listen(EVENT_ENTITY_REGISTRY_UPDATED, _entity_registry_updated)
    )
    entry.async_on_unload(
        hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, _device_registry_updated)
    )
