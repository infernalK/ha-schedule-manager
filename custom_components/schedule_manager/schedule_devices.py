"""Un appareil Home Assistant par planning + interrupteur actif/inactif."""

from __future__ import annotations

import asyncio

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ScheduleManagerCoordinator
from .services import (
    _invalidate_coordinator_slot_marker,
    _notify_schedule_enabled_then_refresh,
    async_persist,
)


class SchedulePlanningSwitchEntity(CoordinatorEntity, SwitchEntity):
    """Interrupteur par planning — appareil dédié (`via_device` → hub Schedule Manager)."""

    def __init__(
        self,
        coordinator: ScheduleManagerCoordinator,
        entry: ConfigEntry,
        schedule_id: str,
    ) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._schedule_id = schedule_id
        self._attr_unique_id = f"{entry.entry_id}_{schedule_id}_planning"
        self._apply_schedule_attrs()

    def _apply_schedule_attrs(self) -> None:
        sch = self.coordinator.storage.get_schedules().get(self._schedule_id)
        if sch is None:
            return
        self._attr_name = sch.name
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{self._entry.entry_id}_{self._schedule_id}")},
            name=sch.name,
            manufacturer="Schedule Manager",
            via_device=(DOMAIN, self._entry.entry_id),
        )

    @property
    def is_on(self) -> bool:
        schedules = self.coordinator.storage.get_schedules()
        sch = schedules.get(self._schedule_id)
        return bool(sch.enabled) if sch else False

    @callback
    def _handle_coordinator_update(self) -> None:
        self._apply_schedule_attrs()
        super()._handle_coordinator_update()

    async def async_turn_on(self, **kwargs) -> None:
        schedules = self.coordinator.storage.get_schedules()
        if self._schedule_id not in schedules:
            return
        schedules[self._schedule_id].enabled = True
        _invalidate_coordinator_slot_marker(self.coordinator.hass)
        await self.coordinator.storage.async_save()
        await _notify_schedule_enabled_then_refresh(
            self.coordinator.hass, self._schedule_id
        )

    async def async_turn_off(self, **kwargs) -> None:
        schedules = self.coordinator.storage.get_schedules()
        if self._schedule_id not in schedules:
            return
        schedules[self._schedule_id].enabled = False
        _invalidate_coordinator_slot_marker(self.coordinator.hass)
        await async_persist(self.coordinator.hass, self.coordinator.storage)


class SchedulePlanningRegistry:
    """Crée / supprime les entités interrupteur quand les plannings changent."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        coordinator: ScheduleManagerCoordinator,
        async_add_entities: AddEntitiesCallback,
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.coordinator = coordinator
        self._async_add_entities = async_add_entities
        self._entities: dict[str, SchedulePlanningSwitchEntity] = {}
        self._sync_lock = asyncio.Lock()

    async def async_add_initial(self) -> None:
        """Entités pour les plannings déjà présents au chargement."""
        for sid in self.coordinator.storage.get_schedules():
            await self._add_one(sid)

    async def _add_one(self, schedule_id: str) -> None:
        if schedule_id in self._entities:
            return
        entity = SchedulePlanningSwitchEntity(
            self.coordinator, self.entry, schedule_id
        )
        self._entities[schedule_id] = entity
        self._async_add_entities([entity])

    async def async_sync(self) -> None:
        """Aligner les entités sur la liste des plannings en stockage."""
        async with self._sync_lock:
            await self._async_sync_impl()

    async def _async_sync_impl(self) -> None:
        schedules = self.coordinator.storage.get_schedules()
        current = set(schedules.keys())
        tracked = set(self._entities.keys())

        for sid in tracked - current:
            entity = self._entities.pop(sid)
            await entity.async_remove()

        for sid in current - tracked:
            await self._add_one(sid)

    @callback
    def coordinator_updated(self) -> None:
        """Coordonnateur mis à jour (après sauvegarde ou tick)."""
        self.hass.async_create_task(self.async_sync())


async def async_setup_planning_switches(
    hass: HomeAssistant,
    entry: ConfigEntry,
    coordinator: ScheduleManagerCoordinator,
    async_add_entities: AddEntitiesCallback,
) -> SchedulePlanningRegistry:
    """Enregistre le registre et les écouteurs."""
    registry = SchedulePlanningRegistry(hass, entry, coordinator, async_add_entities)
    hass.data[DOMAIN]["schedule_planning_registry"] = registry
    await registry.async_add_initial()
    entry.async_on_unload(
        coordinator.async_add_listener(registry.coordinator_updated)
    )
    return registry
