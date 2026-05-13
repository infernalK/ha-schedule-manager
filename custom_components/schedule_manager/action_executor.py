"""Exécution des services Home Assistant décrits dans les plages horaires."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

if TYPE_CHECKING:
    from .models import TimeBlock


async def async_run_block_actions(hass: HomeAssistant, block: "TimeBlock") -> None:
    """Appelle les services HA pour chaque action de la plage (séquentiel, non bloquant côté HA)."""
    n = len(block.actions)
    if n:
        _LOGGER.info(
            "%s: exécution de %d action(s) pour la plage %s",
            DOMAIN,
            n,
            block.id,
        )
    for action in block.actions:
        raw = (action.action_type or "").strip()
        if not raw or "." not in raw:
            _LOGGER.warning(
                "%s: action ignorée (action_type invalide: %r)", DOMAIN, action.action_type
            )
            continue
        domain, _, service = raw.partition(".")
        domain = domain.strip()
        service = service.strip()
        if not domain or not service:
            _LOGGER.warning(
                "%s: action ignorée (domaine ou service vide: %r)", DOMAIN, action.action_type
            )
            continue
        payload = dict(action.action_payload) if action.action_payload else {}
        try:
            _LOGGER.debug(
                "%s: appel service %s.%s (plage %s)",
                DOMAIN,
                domain,
                service,
                block.id,
            )
            await hass.services.async_call(domain, service, payload, blocking=False)
        except Exception as err:  # noqa: BLE001 — journaliser et poursuivre les autres actions
            _LOGGER.error(
                "%s: échec %s.%s (%s) — %s",
                DOMAIN,
                domain,
                service,
                block.id,
                err,
            )
