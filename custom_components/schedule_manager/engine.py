"""Engine for evaluating schedules and determining actions."""

from datetime import datetime, time as dt_time, timedelta
from typing import Optional, Tuple, Dict, Set
from .models import ActiveTimeSlot, Schedule, ScheduleGroup, TimeBlock


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
    def _schedule_ids_in_enabled_groups(groups: Dict[str, ScheduleGroup]) -> Set[str]:
        """Plannings référencés par au moins un groupe activé (réservés à la logique groupe)."""
        out: Set[str] = set()
        for group in groups.values():
            if group.enabled:
                out.update(group.schedules)
        return out

    @staticmethod
    def resolve_group_action(
        groups: Dict[str, ScheduleGroup], schedules: Dict[str, Schedule], current_time: datetime
    ) -> Optional[ActiveTimeSlot]:
        """Résout la plage active : groupes d’abord, puis plannings hors groupe (cas carte Lovelace sans groupe)."""
        for group in groups.values():
            if not group.enabled:
                continue

            active_schedules = []
            for sched_id in group.schedules:
                if sched_id not in schedules:
                    continue
                schedule = schedules[sched_id]
                # Exclusif : si aucun planning actif n’est choisi, on n’exclut personne (sinon tout était ignoré).
                if (
                    group.exclusive
                    and group.active_schedule is not None
                    and group.active_schedule != sched_id
                ):
                    continue
                block = ScheduleEngine.get_current_time_block(schedule, current_time)
                if block:
                    active_schedules.append((sched_id, schedule, block))

            if active_schedules:
                # Priorité : début de plage le plus tardif, puis ordre dans le groupe (dernier = plus prioritaire à égalité).
                def _group_slot_priority(t: tuple[str, Schedule, TimeBlock]) -> tuple:
                    sid, _sch, blk = t
                    try:
                        ord_idx = group.schedules.index(sid)
                    except ValueError:
                        ord_idx = -1
                    return (blk.start_time, ord_idx)

                sid, _sch, blk = max(active_schedules, key=_group_slot_priority)
                return ActiveTimeSlot(schedule_id=sid, block=blk)

        # Aucun groupe actif ne couvre l’instant : évaluer les plannings non rattachés à un groupe activé.
        blocked_ids = ScheduleEngine._schedule_ids_in_enabled_groups(groups)
        candidates: list[tuple[ActiveTimeSlot, int]] = []
        for i, (sid, schedule) in enumerate(schedules.items()):
            if sid in blocked_ids:
                continue
            block = ScheduleEngine.get_current_time_block(schedule, current_time)
            if block:
                candidates.append(
                    (ActiveTimeSlot(schedule_id=sid, block=block), i)
                )
        if not candidates:
            return None
        return max(candidates, key=lambda x: (x[0].block.start_time, x[1]))[0]

    @staticmethod
    def compute_next_schedule_event(
        groups: Dict[str, ScheduleGroup],
        schedules: Dict[str, Schedule],
        now: datetime,
    ) -> Optional[datetime]:
        """Prochain instant où une plage peut commencer ou se terminer (tous plannings activés).

        Inspiré de l’attribut ``next_trigger`` du scheduler-component : permet un réveil ponctuel
        au lieu de ne compter que sur l’intervalle du coordonnateur.
        ``groups`` est réservé à une future restriction ; aujourd’hui tous les plannings activés
        contribuent aux bornes temporelles.
        """
        _ = groups  # extension future (p. ex. ignorer plannings exclus)
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