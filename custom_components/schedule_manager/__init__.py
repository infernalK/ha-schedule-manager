"""Schedule Manager integration for Home Assistant."""

import logging

from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError
from homeassistant.const import Platform
from homeassistant.helpers.device_registry import DeviceEntry
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.start import async_at_started

from .const import DOMAIN, PLATFORMS
from .storage import ScheduleManagerStorage
from .coordinator import ScheduleManagerCoordinator
from .name_sync import async_setup_schedule_name_sync
from .services import async_setup_services, async_delete_schedule

_LOGGER = logging.getLogger(__name__)


async def async_remove_config_entry_device(
    hass: HomeAssistant, config_entry: ConfigEntry, device_entry: DeviceEntry
) -> bool:
    """Gère la suppression d’un appareil depuis Paramètres → Appareils.

    Dans Home Assistant, retourner True = autoriser la suppression dans le registre,
    False = refuser (bloque l’UI).

    - Hub (identifiant = entry_id seul) : refus — supprimer l’intégration à la place.
    - Planning (identifiant = entry_id_<schedule_id>) : supprimer le planning puis autoriser.
    - Identifiants non reconnus : autoriser (nettoyage d’entrées orphelines).
    """
    storage = hass.data.get(DOMAIN, {}).get("storage")
    entry_id = str(config_entry.entry_id)

    if storage is None:
        _LOGGER.warning(
            "Schedule Manager: stockage absent — autorisation de suppression appareil %s",
            device_entry.id,
        )
        return True

    matched_domain = False

    for domain, ident in device_entry.identifiers:
        if str(domain).lower() != DOMAIN.lower():
            continue
        matched_domain = True
        ident_s = str(ident)
        # Hub — même identifiant que la config entry (capteur + interrupteur global)
        if ident_s == entry_id:
            return False
        prefix = f"{entry_id}_"
        if ident_s.startswith(prefix):
            schedule_id = ident_s[len(prefix) :]
            try:
                await async_delete_schedule(hass, storage, schedule_id)
            except HomeAssistantError:
                return False
            return True

    if matched_domain:
        _LOGGER.warning(
            "Schedule Manager: identifiant domaine %s non géré %s — suppression autorisée",
            DOMAIN,
            device_entry.identifiers,
        )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Schedule Manager from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Initialize storage
    storage = ScheduleManagerStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN]["storage"] = storage
    hass.data[DOMAIN]["config_entry_id"] = entry.entry_id

    # Initialize coordinator
    coordinator = ScheduleManagerCoordinator(hass, storage)
    await coordinator.async_config_entry_first_refresh()
    hass.data[DOMAIN]["coordinator"] = coordinator

    # Set up services
    await async_setup_services(hass, storage)

    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async_setup_schedule_name_sync(hass, entry, storage)

    # Le premier cycle a souvent lieu avant l’enregistrement des CoordinatorEntity :
    # sans listener, l’intervalle 60 s du coordinateur ne part pas (voir DataUpdateCoordinator).
    # Un second cycle ici relance l’évaluation du créneau une fois le capteur / interrupteurs chargés.
    await coordinator.async_refresh()

    @callback
    def _on_ha_started(_h: HomeAssistant) -> None:
        """HA prêt : relire les interrupteurs depuis le stockage et exécuter les plages actives."""

        coordinator.prepare_startup_evaluation()
        _h.async_create_task(coordinator.async_refresh())

        @callback
        def _delayed_refresh(_now) -> None:
            _h.async_create_task(coordinator.async_refresh())

        entry.async_on_unload(async_call_later(_h, 75, _delayed_refresh))

    entry.async_on_unload(async_at_started(hass, _on_ha_started))

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    coordinator = hass.data.get(DOMAIN, {}).get("coordinator")
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if coordinator is not None:
        coordinator.cancel_all_watchers()
    if unload_ok:
        hass.data[DOMAIN].pop("schedule_planning_registry", None)
        hass.data[DOMAIN].pop("storage", None)
        hass.data[DOMAIN].pop("coordinator", None)
    return unload_ok