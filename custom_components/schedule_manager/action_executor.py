"""Exécution des services Home Assistant décrits dans les plages horaires."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

if TYPE_CHECKING:
    from .models import TimeBlock


def _iter_entity_ids_from_payload(payload: dict) -> list[str]:
    """Extrait les entity_id d’un payload de service (chaîne ou liste)."""
    raw = payload.get("entity_id")
    if isinstance(raw, str) and "." in raw:
        return [raw]
    if isinstance(raw, list):
        return [str(x) for x in raw if isinstance(x, str) and "." in x]
    return []


def block_target_entities_ready(hass: HomeAssistant, block: "TimeBlock") -> bool:
    """True si toutes les entités référencées existent déjà dans le registre d’état."""
    needed: set[str] = set()
    for action in block.actions:
        pl = action.action_payload
        if isinstance(pl, dict):
            needed.update(_iter_entity_ids_from_payload(pl))
    for eid in needed:
        if hass.states.get(eid) is None:
            _LOGGER.info(
                "%s: entité %s absente (démarrage HA ou intégration pas prête) — "
                "exécution de la plage %s reportée",
                DOMAIN,
                eid,
                block.id,
            )
            return False
    return True


async def async_run_block_actions(hass: HomeAssistant, block: "TimeBlock") -> bool:
    """Appelle les services HA pour chaque action. Retourne False si report (entités / erreur)."""
    n = len(block.actions)
    if n == 0:
        return True

    if not block_target_entities_ready(hass, block):
        return False

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
        except Exception as err:  # noqa: BLE001
            _LOGGER.error(
                "%s: échec %s.%s (%s) — %s",
                DOMAIN,
                domain,
                service,
                block.id,
                err,
            )
            return False
    return True
