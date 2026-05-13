"""Exécution des services Home Assistant décrits dans les plages horaires."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from homeassistant.core import HomeAssistant

from .const import (
    ACTION_PAYLOAD_META_KEYS,
    ACTION_PAYLOAD_META_KEY_PREFIX,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)

if TYPE_CHECKING:
    from .models import TimeBlock


def _payload_for_service_call(payload: dict) -> dict:
    """Copie du payload sans métadonnées carte (schémas HA « extra keys »).

    Nettoyage récursif : la couleur peut se retrouver à la racine ou dans ``target`` / listes.
    Toute clé ``schedule_manager_*`` est retirée (réservée à l’UI carte).
    """

    def _is_reserved_key(key: object) -> bool:
        if not isinstance(key, str):
            return False
        if key in ACTION_PAYLOAD_META_KEYS:
            return True
        return key.startswith(ACTION_PAYLOAD_META_KEY_PREFIX)

    def _scrub(obj: object) -> object:
        if not isinstance(obj, dict):
            return obj
        out: dict = {}
        for k, v in obj.items():
            if _is_reserved_key(k):
                continue
            if isinstance(v, dict):
                out[k] = _scrub(v)
            elif isinstance(v, list):
                out[k] = [_scrub(i) if isinstance(i, dict) else i for i in v]
            else:
                out[k] = v
        return out

    return _scrub(dict(payload))


def _iter_entity_ids_from_payload(payload: dict) -> list[str]:
    """Extrait les entity_id d’un payload de service (racine ou sous-clé ``target``)."""
    out: list[str] = []
    raw = payload.get("entity_id")
    if isinstance(raw, str) and "." in raw:
        out.append(raw)
    elif isinstance(raw, list):
        out.extend(str(x) for x in raw if isinstance(x, str) and "." in x)
    nested = payload.get("target")
    if isinstance(nested, dict):
        out.extend(_iter_entity_ids_from_payload(nested))
    return out


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
    invoked = 0
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
        raw_payload = dict(action.action_payload) if action.action_payload else {}
        payload = _payload_for_service_call(raw_payload)
        try:
            _LOGGER.debug(
                "%s: appel service %s.%s (plage %s)",
                DOMAIN,
                domain,
                service,
                block.id,
            )
            await hass.services.async_call(domain, service, payload, blocking=False)
            invoked += 1
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
    if invoked == 0:
        _LOGGER.error(
            "%s: aucun appel de service effectué pour la plage %s (vérifiez action_type domaine.service)",
            DOMAIN,
            block.id,
        )
        return False
    return True
