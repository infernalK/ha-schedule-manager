"""Schedule Manager integration for Home Assistant."""

import logging

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError
from homeassistant.const import Platform
from homeassistant.helpers.device_registry import DeviceEntry
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.start import async_at_started

from .const import CARD_STATIC_URL_BASE, CARD_URL_PATH, DOMAIN, PLATFORMS
from .storage import ScheduleManagerStorage
from .coordinator import ScheduleManagerCoordinator
from .name_sync import async_setup_schedule_name_sync
from .services import (
    SERVICE_CLEAR_OVERRIDE,
    SERVICE_CREATE_SCHEDULE,
    SERVICE_DELETE_SCHEDULE,
    SERVICE_DISABLE_SCHEDULE,
    SERVICE_ENABLE_SCHEDULE,
    SERVICE_RUN_ACTIONS,
    SERVICE_SET_OVERRIDE,
    SERVICE_UPDATE_SCHEDULE,
    async_setup_services,
    async_delete_schedule,
)

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


async def _async_register_card(hass: HomeAssistant) -> None:
    """Sert la carte Lovelace embarquée et l'enregistre comme module frontend.

    `single_config_entry` : au plus une entrée existe, donc pas de garde nécessaire
    contre un double enregistrement inter-entrées — seulement contre un rechargement.
    """
    if hass.data[DOMAIN].get("card_registered"):
        return
    www_path = hass.config.path(f"custom_components/{DOMAIN}/www")
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_STATIC_URL_BASE, www_path, False)]
    )
    add_extra_js_url(hass, CARD_URL_PATH)
    hass.data[DOMAIN]["card_registered"] = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Schedule Manager from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    await _async_register_card(hass)

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
    coordinator.prepare_startup_evaluation()
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
        # `single_config_entry` : il n'y a jamais qu'une entrée, donc la retirer libère
        # bien tous les handlers (sinon ils restent enregistrés sur un stockage orphelin).
        for service in (
            SERVICE_CREATE_SCHEDULE,
            SERVICE_UPDATE_SCHEDULE,
            SERVICE_ENABLE_SCHEDULE,
            SERVICE_DISABLE_SCHEDULE,
            SERVICE_DELETE_SCHEDULE,
            SERVICE_SET_OVERRIDE,
            SERVICE_CLEAR_OVERRIDE,
            SERVICE_RUN_ACTIONS,
        ):
            hass.services.async_remove(DOMAIN, service)
    return unload_ok