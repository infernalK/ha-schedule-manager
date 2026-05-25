"""Engine for evaluating schedules and determining actions."""

from datetime import datetime, time as dt_time, timedelta
from typing import Dict, List, Optional, Tuple

from .models import ActiveTimeSlot, Schedule, TimeBlock


class ScheduleEngine:
    """Evaluates schedules to determine current and next actions."""

    @staticmethod
    def _time_in_block(current_t: dt_time, block: TimeBlock) -> bool:
        """Plage [début, fin) sur l’horloge ; si fin < début, la plage passe minuit (comme la carte)."""
        start, end = block.start_time, block.end_time
        if start < end:
            return start <= current_t < end
        if start > end:
            return current_t >= start or current_t < end
        return False

    @staticmethod
    def get_current_time_block(schedule: Schedule, current_time: datetime) -> Optional[TimeBlock]:
        """Get the current time block for a schedule at the given time."""
        if not schedule.enabled:
            return None

        # Check if schedule is active on current day
        current_day = current_time.weekday()  # 0=Monday
        if current_day not in schedule.repeat_days:
            return None

        current_t = current_time.time()
        # Plusieurs plages peuvent théoriquement chevaucher (données héritées, ordre JSON variable).
        # Le créneau « actif » sur la frise = celui qui a commencé le plus tard tout en couvrant l’instant.
        matches = [b for b in schedule.time_blocks if ScheduleEngine._time_in_block(current_t, b)]
        if not matches:
            return None
        latest_start = max(b.start_time for b in matches)
        contenders = [b for b in matches if b.start_time == latest_start]
        # Même heure de début (doublon) : dernier dans la liste = surcharge côté carte.
        return contenders[-1]

    @staticmethod
    def get_next_time_block(schedule: Schedule, current_time: datetime) -> Optional[Tuple[TimeBlock, datetime]]:
        """Get the next time block and its start time."""
        if not schedule.enabled:
            return None

        current_day = current_time.weekday()
        current_t = current_time.time()

        # Check today's remaining blocks
        for block in schedule.time_blocks:
            if block.start_time > current_t:
                next_time = datetime.combine(current_time.date(), block.start_time)
                return block, next_time

        # Check next days
        for day_offset in range(1, 8):
            check_day = (current_day + day_offset) % 7
            if check_day in schedule.repeat_days:
                next_date = current_time.date() + timedelta(days=day_offset)
                # Get first block of that day
                if schedule.time_blocks:
                    first_block = min(schedule.time_blocks, key=lambda b: b.start_time)
                    next_time = datetime.combine(next_date, first_block.start_time)
                    return first_block, next_time

        return None

    @staticmethod
    def resolve_active_slots_for_execution(
        schedules: Dict[str, Schedule], current_time: datetime
    ) -> List[ActiveTimeSlot]:
        """Tous les créneaux à exécuter à l’instant : plages actives dont le début est le plus tardif.

        Si deux plannings ont une plage qui commence à la même heure (et que c’est le début le plus
        tardif parmi les plages actuellement couvrant l’instant), les deux sont retournés — leurs
        actions seront enchaînées. Ordre stable : ``schedule_id`` croissant.
        """
        candidates: List[ActiveTimeSlot] = []
        for sid, schedule in schedules.items():
            block = ScheduleEngine.get_current_time_block(schedule, current_time)
            if block:
                candidates.append(ActiveTimeSlot(schedule_id=sid, block=block))
        if not candidates:
            return []
        max_st = max(s.block.start_time for s in candidates)
        same_start = [s for s in candidates if s.block.start_time == max_st]
        same_start.sort(key=lambda s: s.schedule_id)
        return same_start

    @staticmethod
    def resolve_active_slot(
        schedules: Dict[str, Schedule], current_time: datetime
    ) -> Optional[ActiveTimeSlot]:
        """Premier créneau actif (affichage / compat) — voir ``resolve_active_slots_for_execution``."""
        slots = ScheduleEngine.resolve_active_slots_for_execution(schedules, current_time)
        return slots[0] if slots else None

    @staticmethod
    def resolve_slot_for_newly_enabled_schedule(
        schedules: Dict[str, Schedule],
        schedule_id: str,
        current_time: datetime,
    ) -> Optional[ActiveTimeSlot]:
        """Plage à exécuter immédiatement quand un planning vient d’être activé.

        Le coordinateur n’exécute que les plages au début le plus tardif parmi les plannings
        actifs. Un planning réactivé peut avoir une plage couvrant l’instant mais un début
        plus tôt qu’un autre planning — il faut alors lancer ses actions explicitement.
        """
        sch = schedules.get(schedule_id)
        if sch is None or not sch.enabled:
            return None
        block = ScheduleEngine.get_current_time_block(sch, current_time)
        if block is None:
            return None
        batch = ScheduleEngine.resolve_active_slots_for_execution(schedules, current_time)
        if any(slot.schedule_id == schedule_id for slot in batch):
            return None
        return ActiveTimeSlot(schedule_id=schedule_id, block=block)

    @staticmethod
    def compute_next_schedule_event(
        schedules: Dict[str, Schedule],
        now: datetime,
    ) -> Optional[datetime]:
        """Prochain instant où une plage peut commencer ou se terminer (tous plannings activés).

        Inspiré de l’attribut ``next_trigger`` du scheduler-component : permet un réveil ponctuel
        au lieu de ne compter que sur l’intervalle du coordonnateur.
        """
        tzinfo = now.tzinfo
        if tzinfo is None:
            raise ValueError("now must be timezone-aware")

        best: Optional[datetime] = None

        def consider(candidate: datetime) -> None:
            nonlocal best
            if candidate <= now:
                return
            if best is None or candidate < best:
                best = candidate

        for _sid, sch in schedules.items():
            if not sch.enabled:
                continue
            for day_offset in range(0, 8):
                day = now.date() + timedelta(days=day_offset)
                if day.weekday() not in sch.repeat_days:
                    continue
                for block in sch.time_blocks:
                    st = block.start_time
                    et = block.end_time
                    consider(datetime.combine(day, st, tzinfo=tzinfo))
                    if st < et:
                        consider(datetime.combine(day, et, tzinfo=tzinfo))
                    elif st > et:
                        consider(datetime.combine(day + timedelta(days=1), et, tzinfo=tzinfo))
        return best
