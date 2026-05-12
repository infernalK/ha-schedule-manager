"""Services for Schedule Manager."""

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from .models import Override, Schedule, ScheduleGroup, TimeBlock
from .storage import ScheduleManagerStorage
from .const import DOMAIN


async def _persist(hass: HomeAssistant, storage: ScheduleManagerStorage) -> None:
    """Persist storage and refresh coordinator so entities/cards update."""
    await storage.async_save()
    coordinator = hass.data.get(DOMAIN, {}).get("coordinator")
    if coordinator:
        await coordinator.async_request_refresh()

SERVICE_CREATE_SCHEDULE = "create_schedule"
SERVICE_ENABLE_SCHEDULE = "enable_schedule"
SERVICE_DISABLE_SCHEDULE = "disable_schedule"
SERVICE_DELETE_SCHEDULE = "delete_schedule"

SERVICE_CREATE_GROUP = "create_group"
SERVICE_ENABLE_GROUP = "enable_group"
SERVICE_DISABLE_GROUP = "disable_group"
SERVICE_SET_ACTIVE_SCHEDULE = "set_active_schedule"

SERVICE_SET_OVERRIDE = "set_override"
SERVICE_CLEAR_OVERRIDE = "clear_override"

CREATE_SCHEDULE_SCHEMA = vol.Schema({
    vol.Required("name"): cv.string,
    vol.Optional("time_blocks"): vol.All(cv.ensure_list, [vol.Schema({
        vol.Required("start_time"): cv.time,
        vol.Required("end_time"): cv.time,
        vol.Required("action_type"): cv.string,
        vol.Required("action_payload"): dict,
    })]),
    vol.Optional("repeat_days"): vol.All(cv.ensure_list, [vol.In(range(7))]),
})

ENABLE_DISABLE_SCHEMA = vol.Schema({
    vol.Required("schedule_id"): cv.string,
})

DELETE_SCHEMA = vol.Schema({
    vol.Required("schedule_id"): cv.string,
})

CREATE_GROUP_SCHEMA = vol.Schema({
    vol.Required("name"): cv.string,
    vol.Optional("schedules"): vol.All(cv.ensure_list, [cv.string]),
    vol.Optional("exclusive"): cv.boolean,
})

SET_ACTIVE_SCHEMA = vol.Schema({
    vol.Required("group_id"): cv.string,
    vol.Required("schedule_id"): cv.string,
})

SET_OVERRIDE_SCHEMA = vol.Schema({
    vol.Required("target_entity"): cv.entity_id,
    vol.Required("action_type"): cv.string,
    vol.Required("action_payload"): dict,
    vol.Optional("duration", default=3600): cv.positive_int,
})

CLEAR_OVERRIDE_SCHEMA = vol.Schema({
    vol.Required("override_id"): cv.string,
})


async def async_setup_services(hass: HomeAssistant, storage: ScheduleManagerStorage) -> None:
    """Set up services for Schedule Manager."""

    async def handle_create_schedule(call: ServiceCall) -> None:
        schedule = Schedule(
            name=call.data["name"],
            time_blocks=[TimeBlock(**tb) for tb in call.data.get("time_blocks", [])],
            repeat_days=call.data.get("repeat_days", list(range(7))),
        )
        storage.add_schedule(schedule)
        await _persist(hass, storage)

    async def handle_enable_schedule(call: ServiceCall) -> None:
        schedule_id = call.data["schedule_id"]
        schedules = storage.get_schedules()
        if schedule_id in schedules:
            schedules[schedule_id].enabled = True
            await _persist(hass, storage)

    async def handle_disable_schedule(call: ServiceCall) -> None:
        schedule_id = call.data["schedule_id"]
        schedules = storage.get_schedules()
        if schedule_id in schedules:
            schedules[schedule_id].enabled = False
            await _persist(hass, storage)

    async def handle_delete_schedule(call: ServiceCall) -> None:
        schedule_id = call.data["schedule_id"]
        storage.remove_schedule(schedule_id)
        await _persist(hass, storage)

    async def handle_create_group(call: ServiceCall) -> None:
        group = ScheduleGroup(
            name=call.data["name"],
            schedules=call.data.get("schedules", []),
            exclusive=call.data.get("exclusive", False),
        )
        storage.add_group(group)
        await _persist(hass, storage)

    async def handle_enable_group(call: ServiceCall) -> None:
        group_id = call.data["group_id"]
        groups = storage.get_groups()
        if group_id in groups:
            groups[group_id].enabled = True
            await _persist(hass, storage)

    async def handle_disable_group(call: ServiceCall) -> None:
        group_id = call.data["group_id"]
        groups = storage.get_groups()
        if group_id in groups:
            groups[group_id].enabled = False
            await _persist(hass, storage)

    async def handle_set_active_schedule(call: ServiceCall) -> None:
        group_id = call.data["group_id"]
        schedule_id = call.data["schedule_id"]
        groups = storage.get_groups()
        if group_id in groups:
            groups[group_id].active_schedule = schedule_id
            await _persist(hass, storage)

    async def handle_set_override(call: ServiceCall) -> None:
        override = Override(
            target_entity=call.data["target_entity"],
            action_type=call.data["action_type"],
            action_payload=call.data["action_payload"],
            duration=call.data["duration"],
            start_time=hass.loop.time(),
        )
        storage.add_override(override)
        await _persist(hass, storage)

    async def handle_clear_override(call: ServiceCall) -> None:
        override_id = call.data["override_id"]
        storage.remove_override(override_id)
        await _persist(hass, storage)

    hass.services.async_register(DOMAIN, SERVICE_CREATE_SCHEDULE, handle_create_schedule, schema=CREATE_SCHEDULE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ENABLE_SCHEDULE, handle_enable_schedule, schema=ENABLE_DISABLE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DISABLE_SCHEDULE, handle_disable_schedule, schema=ENABLE_DISABLE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DELETE_SCHEDULE, handle_delete_schedule, schema=DELETE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_CREATE_GROUP, handle_create_group, schema=CREATE_GROUP_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ENABLE_GROUP, handle_enable_group, schema=vol.Schema({vol.Required("group_id"): cv.string}))
    hass.services.async_register(DOMAIN, SERVICE_DISABLE_GROUP, handle_disable_group, schema=vol.Schema({vol.Required("group_id"): cv.string}))
    hass.services.async_register(DOMAIN, SERVICE_SET_ACTIVE_SCHEDULE, handle_set_active_schedule, schema=SET_ACTIVE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SET_OVERRIDE, handle_set_override, schema=SET_OVERRIDE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_CLEAR_OVERRIDE, handle_clear_override, schema=CLEAR_OVERRIDE_SCHEMA)