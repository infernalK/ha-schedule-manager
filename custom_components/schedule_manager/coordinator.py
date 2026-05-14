"""Data coordinator for Schedule Manager."""

import contextvars
import hashlib
import json
import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Optional

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_point_in_time
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .action_executor import async_run_block_actions
from .const import DOMAIN
from .engine import ScheduleEngine
from .models import TimeBlock
from .storage import ScheduleManagerStorage

# Instant de borne programmé par async_track_point_in_time (uniquement le task du réveil).
_BOUNDARY_EVAL_SNAP: contextvars.ContextVar[Optional[datetime]] = contextvars.ContextVar(
    "schedule_manager_boundary_eval_snap", default=None
)


def _fingerprint_block_actions(block: TimeBlock) -> str:
    """Empreinte stable des actions : la clé de créneau change si seules les actions changent."""
    payload = [
        {
            "id": (a.id or "").strip(),
            "t": (a.action_type or "").strip(),
            "p": a.action_payload or {},
        }
        for a in block.actions
    ]
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _slot_key(schedule_id: str, block: TimeBlock) -> str:
    """Clé unique du créneau (planning + plage + bornes + actions)."""
    return (
        f"{schedule_id}:{block.id}:{block.start_time.isoformat()}:"
        f"{block.end_time.isoformat()}:{_fingerprint_block_actions(block)}"
    )


def _composite_slot_key(slots: list) -> str:
    """Clé stable pour un ensemble de créneaux exécutés ensemble (séparateur improbable dans les clés)."""
    keys = sorted(_slot_key(s.schedule_id, s.block) for s in slots)
    return "\x1e".join(keys)


class ScheduleManagerCoordinator(DataUpdateCoordinator):
    """Coordinator for Schedule Manager data."""

    def __init__(self, hass: HomeAssistant, storage: ScheduleManagerStorage):
        super().__init__(
            hass,
            logger=logging.getLogger(f"{__name__}.{DOMAIN}"),
            name=DOMAIN,
            # Secours si le réveil ponctuel rate un bord (inspiré du scheduler-component + timer HA).
            update_interval=timedelta(seconds=60),
        )
        self.storage = storage
        self.engine = ScheduleEngine()
        self._last_executed_slot_key: Optional[str] = None
        self._boundary_unsub: Optional[Callable[[], None]] = None
        self._deferred_unsub: Optional[Callable[[], None]] = None

    def cancel_boundary_watcher(self) -> None:
        """Annule le réveil sur la prochaine transition (déchargement intégration)."""
        if self._boundary_unsub is not None:
            self._boundary_unsub()
            self._boundary_unsub = None

    def cancel_deferred_refresh(self) -> None:
        """Annule le rafraîchissement différé (entités pas encore prêtes au boot)."""
        if self._deferred_unsub is not None:
            self._deferred_unsub()
            self._deferred_unsub = None

    def cancel_all_watchers(self) -> None:
        self.cancel_boundary_watcher()
        self.cancel_deferred_refresh()

    def reset_executed_slot_marker(self) -> None:
        """Après modification du stockage : rejouer la plage si elle est toujours active.

        La clé de créneau inclut une empreinte des actions ; ce reset couvre les cas où
        l’état mémoire du coordinateur doit être forcé (ex. chemins sans recalcul immédiat).
        """
        self._last_executed_slot_key = None

    def _schedule_boundary_watcher(self, next_when: Optional[datetime]) -> None:
        """Programme un rafraîchissement à la prochaine borne start/end de plage."""
        self.cancel_boundary_watcher()
        if next_when is None:
            return
        now = dt_util.now()
        if next_when <= now:
            next_when = now + timedelta(seconds=5)

        scheduled_at = next_when

        @callback
        def _on_boundary(_now: datetime) -> None:
            # Éviter async_request_refresh : il est débouncé et peut retarder ou fusionner les bords de plage.
            async def _boundary_refresh() -> None:
                token = _BOUNDARY_EVAL_SNAP.set(scheduled_at)
                try:
                    await self.async_refresh()
                finally:
                    _BOUNDARY_EVAL_SNAP.reset(token)

            self.hass.async_create_task(_boundary_refresh())

        self._boundary_unsub = async_track_point_in_time(self.hass, _on_boundary, next_when)

    def _schedule_deferred_refresh(self, delay_seconds: int = 90) -> None:
        """Un seul timer : réessaie après que les entités aient eu le temps de s’enregistrer."""
        if self._deferred_unsub is not None:
            return

        @callback
        def _fire(_now: datetime) -> None:
            self._deferred_unsub = None
            self.hass.async_create_task(self.async_refresh())

        self._deferred_unsub = async_call_later(self.hass, delay_seconds, _fire)
        self.logger.debug(
            "%s: rafraîchissement différé dans %ss (entités / démarrage)",
            DOMAIN,
            delay_seconds,
        )

    async def _async_update_data(self):
        """Update data."""
        current_time = dt_util.now()
        planned = _BOUNDARY_EVAL_SNAP.get()
        if planned is not None:
            # Si « maintenant » est encore un soupçon avant l’instant de borne du timer,
            # l’ancien créneau peut encore matcher — on aligne sur la borne programmée (≤ 2 s).
            skew_sec = (planned - current_time).total_seconds()
            if 0 < skew_sec <= 5.0:
                current_time = planned
        schedules = self.storage.get_schedules()

        slots = self.engine.resolve_active_slots_for_execution(schedules, current_time)
        slot_key = _composite_slot_key(slots) if slots else None
        slot = slots[0] if slots else None
        current_block = slot.block if slot else None

        if slot_key != self._last_executed_slot_key:
            if slots:
                if not self.hass.is_running:
                    self.logger.debug(
                        "%s: Home Assistant pas encore prêt (is_running=False) — exécution des actions reportée",
                        DOMAIN,
                    )
                else:
                    all_ok = True
                    for sl in slots:
                        ok = await async_run_block_actions(self.hass, sl.block)
                        if not ok:
                            all_ok = False
                            break
                    if all_ok:
                        self._last_executed_slot_key = slot_key
                    else:
                        self._schedule_deferred_refresh()
            else:
                self._last_executed_slot_key = None

        next_wakeup = self.engine.compute_next_schedule_event(schedules, current_time)

        self._schedule_boundary_watcher(next_wakeup)

        return {
            "active_time_slot": slot,
            "current_time_block": current_block,
            "next_trigger": next_wakeup.isoformat() if next_wakeup else None,
            "schedules": schedules,
        }
