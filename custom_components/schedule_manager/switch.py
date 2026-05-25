"""Switch platform for Schedule Manager."""

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ScheduleManagerCoordinator
from .schedule_devices import async_setup_planning_switches
from .services import _invalidate_coordinator_slot_marker, async_persist


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the switch platform from a config entry."""
    coordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities([ScheduleManagerSwitch(coordinator, entry)])
    await async_setup_planning_switches(hass, entry, coordinator, async_add_entities)


class ScheduleManagerSwitch(CoordinatorEntity, SwitchEntity):
    """Interrupteur global hub — état persisté, suspend toute exécution si OFF."""

    def __init__(
        self, coordinator: ScheduleManagerCoordinator, entry: ConfigEntry
    ) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_translation_key = "hub_enabled"
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_enabled"

    @property
    def device_info(self) -> DeviceInfo:
        """Même appareil que le capteur d’état."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            manufacturer="Schedule Manager",
            translation_key="hub",
        )

    @property
    def is_on(self) -> bool:
        return self.coordinator.storage.is_scheduling_enabled()

    async def async_turn_on(self, **kwargs) -> None:
        self.coordinator.storage.set_scheduling_enabled(True)
        _invalidate_coordinator_slot_marker(self.coordinator.hass)
        self.coordinator.prepare_startup_evaluation()
        await async_persist(self.coordinator.hass, self.coordinator.storage)

    async def async_turn_off(self, **kwargs) -> None:
        self.coordinator.storage.set_scheduling_enabled(False)
        _invalidate_coordinator_slot_marker(self.coordinator.hass)
        await async_persist(self.coordinator.hass, self.coordinator.storage)
