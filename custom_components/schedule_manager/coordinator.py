"""Data coordinator for Schedule Manager."""

import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Optional

from homeassistant.core import CoreState, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_point_in_time
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .action_executor import async_run_block_actions
from .const import DOMAIN
from .engine import ScheduleEngine
from .storage import ScheduleManagerStorage


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
        """Après modification du stockage (plages, jours, activé) : rejouer la plage si elle est toujours active.

        Sans cela, la clé (planning + horaires) ne change pas quand seules les actions changent — les
        nouveaux services ne sont pas appelés tant que la plage ne se rouvre pas.
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

        @callback
        def _on_boundary(_now) -> None:
            self.hass.async_create_task(self.async_request_refresh())

        self._boundary_unsub = async_track_point_in_time(self.hass, _on_boundary, next_when)

    def _schedule_deferred_refresh(self, delay_seconds: int = 90) -> None:
        """Un seul timer : réessaie après que les entités aient eu le temps de s’enregistrer."""
        if self._deferred_unsub is not None:
            return

        @callback
        def _fire(_now: datetime) -> None:
            self._deferred_unsub = None
            self.hass.async_create_task(self.async_request_refresh())

        self._deferred_unsub = async_call_later(self.hass, delay_seconds, _fire)
        self.logger.debug(
            "%s: rafraîchissement différé dans %ss (entités / démarrage)",
            DOMAIN,
            delay_seconds,
        )

    async def _async_update_data(self):
        """Update data."""
        current_time = dt_util.now()
        schedules = self.storage.get_schedules()
        groups = self.storage.get_groups()

        slot = self.engine.resolve_group_action(groups, schedules, current_time)
        current_block = slot.block if slot else None
        slot_key = (
            f"{slot.schedule_id}:{slot.block.start_time.isoformat()}:{slot.block.end_time.isoformat()}"
            if slot
            else None
        )

        if slot_key != self._last_executed_slot_key:
            if slot is not None:
                if self.hass.state is not CoreState.running:
                    self.logger.debug(
                        "%s: cœur HA non « running » — exécution des actions reportée",
                        DOMAIN,
                    )
                else:
                    ok = await async_run_block_actions(self.hass, slot.block)
                    if ok:
                        self._last_executed_slot_key = slot_key
                    else:
                        self._schedule_deferred_refresh()
            else:
                self._last_executed_slot_key = None

        next_wakeup = self.engine.compute_next_schedule_event(groups, schedules, current_time)

        self._schedule_boundary_watcher(next_wakeup)

        return {
            "active_time_slot": slot,
            "current_time_block": current_block,
            "next_trigger": next_wakeup.isoformat() if next_wakeup else None,
            "schedules": schedules,
            "groups": groups,
        }
