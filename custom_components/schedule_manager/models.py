"""Data models for Schedule Manager."""

from dataclasses import dataclass, field
from datetime import time
from typing import Any, Dict, List, Optional
import uuid


@dataclass
class TimeBlock:
    """Represents a time block in a schedule."""
    start_time: time
    end_time: time
    action_type: str
    action_payload: Dict[str, Any]
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class Schedule:
    """Represents a schedule."""
    name: str
    time_blocks: List[TimeBlock] = field(default_factory=list)
    enabled: bool = True
    repeat_days: List[int] = field(default_factory=lambda: list(range(7)))  # 0=Monday, 6=Sunday
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class ScheduleGroup:
    """Represents a group of schedules."""
    name: str
    schedules: List[str] = field(default_factory=list)  # List of schedule IDs
    exclusive: bool = False  # If true, only one schedule active at a time
    active_schedule: Optional[str] = None
    enabled: bool = True
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class Override:
    """Represents a temporary override."""
    target_entity: str
    action_type: str
    action_payload: Dict[str, Any]
    duration: int  # seconds
    start_time: float  # timestamp
    id: str = field(default_factory=lambda: str(uuid.uuid4()))