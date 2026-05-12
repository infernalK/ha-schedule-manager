"""Engine for evaluating schedules and determining actions."""

from datetime import datetime, time as dt_time, timedelta
from typing import Optional, Tuple, Dict
from .models import Schedule, ScheduleGroup, TimeBlock


class ScheduleEngine:
    """Evaluates schedules to determine current and next actions."""

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
        for block in schedule.time_blocks:
            if block.start_time <= current_t < block.end_time:
                return block
        return None

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
    def resolve_group_action(groups: Dict[str, ScheduleGroup], schedules: Dict[str, Schedule], current_time: datetime) -> Optional[TimeBlock]:
        """Resolve the current action for groups (handling exclusive groups)."""
        for group in groups.values():
            if not group.enabled:
                continue

            active_schedules = []
            for sched_id in group.schedules:
                if sched_id in schedules:
                    schedule = schedules[sched_id]
                    if group.exclusive and group.active_schedule != sched_id:
                        continue
                    block = ScheduleEngine.get_current_time_block(schedule, current_time)
                    if block:
                        active_schedules.append((schedule, block))

            if active_schedules:
                # For now, return the first active block; could implement priority later
                return active_schedules[0][1]

        return None