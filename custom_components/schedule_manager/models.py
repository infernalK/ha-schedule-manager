"""Data models for Schedule Manager."""

from dataclasses import dataclass, field
from datetime import time
from typing import Any, Dict, List, Optional
import uuid


def _parse_time(value: Any) -> time:
    """Parse time from storage (time object or HH:MM / HH:MM:SS string)."""
    if isinstance(value, time):
        return value
    if not isinstance(value, str):
        raise ValueError(f"Invalid time value: {value!r}")
    parts = value.strip().split(":")
    h = int(parts[0])
    m = int(parts[1])
    sec = int(parts[2]) if len(parts) > 2 else 0
    return time(h, m, sec)


def time_block_to_dict(block: Optional["TimeBlock"]) -> Optional[Dict[str, Any]]:
    """Serialize a time block for entity attributes or storage."""
    if block is None:
        return None
    return {
        "id": block.id,
        "start_time": block.start_time.isoformat(),
        "end_time": block.end_time.isoformat(),
        "actions": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "action_payload": a.action_payload,
            }
            for a in block.actions
        ],
    }


def time_block_from_dict(data: Dict[str, Any]) -> "TimeBlock":
    """Deserialize a time block from storage (incl. ancien format `action_type` seul)."""
    raw_actions = data.get("actions")
    if raw_actions is None:
        at = data.get("action_type")
        if at:
            raw_actions = [
                {
                    "action_type": at,
                    "action_payload": data.get("action_payload", {}),
                }
            ]
        else:
            raw_actions = []
    actions: List[BlockAction] = []
    for a in raw_actions:
        if not isinstance(a, dict):
            continue
        if not a.get("action_type"):
            continue
        actions.append(
            BlockAction(
                id=a.get("id", str(uuid.uuid4())),
                action_type=a["action_type"],
                action_payload=a.get("action_payload", {}),
            )
        )
    return TimeBlock(
        start_time=_parse_time(data["start_time"]),
        end_time=_parse_time(data["end_time"]),
        actions=actions,
        id=data.get("id", str(uuid.uuid4())),
    )


def _coerce_bool(value: Any, default: bool = True) -> bool:
    """Interprète un booléen depuis le stockage JSON (évite ``\"false\"`` truthy)."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes", "on")
    if isinstance(value, (int, float)):
        return bool(value)
    if value is None:
        return default
    return default


def schedule_to_dict(schedule: "Schedule") -> Dict[str, Any]:
    """Serialize a schedule for entity attributes or storage."""
    return {
        "id": schedule.id,
        "name": schedule.name,
        "enabled": schedule.enabled,
        "repeat_days": schedule.repeat_days,
        "time_blocks": [time_block_to_dict(tb) for tb in schedule.time_blocks],
    }


def schedule_from_dict(data: Dict[str, Any]) -> "Schedule":
    """Deserialize a schedule from storage."""
    return Schedule(
        id=data.get("id", str(uuid.uuid4())),
        name=data["name"],
        enabled=_coerce_bool(data.get("enabled"), True),
        repeat_days=data.get("repeat_days", list(range(7))),
        time_blocks=[time_block_from_dict(tb) for tb in data.get("time_blocks", [])],
    )


def override_to_dict(override: "Override") -> Dict[str, Any]:
    """Serialize an override for storage."""
    return {
        "id": override.id,
        "target_entity": override.target_entity,
        "action_type": override.action_type,
        "action_payload": override.action_payload,
        "duration": override.duration,
        "start_time": override.start_time,
    }


def override_from_dict(data: Dict[str, Any]) -> "Override":
    """Deserialize an override from storage."""
    return Override(
        id=data.get("id", str(uuid.uuid4())),
        target_entity=data["target_entity"],
        action_type=data["action_type"],
        action_payload=data.get("action_payload", {}),
        duration=data["duration"],
        start_time=float(data["start_time"]),
    )


@dataclass
class BlockAction:
    """Une action (service Home Assistant) dans une plage horaire."""

    action_type: str
    action_payload: Dict[str, Any]
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class TimeBlock:
    """Represents a time block in a schedule."""

    start_time: time
    end_time: time
    actions: List[BlockAction] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class ActiveTimeSlot:
    """Créneau actuellement actif, avec l’identifiant du planning source (exécution des actions)."""

    schedule_id: str
    block: TimeBlock


@dataclass
class Schedule:
    """Represents a schedule."""

    name: str
    time_blocks: List[TimeBlock] = field(default_factory=list)
    enabled: bool = True
    repeat_days: List[int] = field(default_factory=lambda: list(range(7)))  # 0=Monday, 6=Sunday
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
