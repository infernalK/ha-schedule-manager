# Schedule Manager Integration

Home Assistant integration for managing schedules with time blocks and actions.

## Installation

1. Copy `custom_components/schedule_manager` to your Home Assistant `custom_components` directory.
2. Restart Home Assistant.
3. Add the integration via Configuration > Integrations.

## Services

- `schedule_manager.create_schedule`: Create a new schedule
- `schedule_manager.enable_schedule`: Enable a schedule
- `schedule_manager.disable_schedule`: Disable a schedule
- `schedule_manager.delete_schedule`: Delete a schedule
- `schedule_manager.create_group`: Create a schedule group
- `schedule_manager.enable_group`: Enable a group
- `schedule_manager.disable_group`: Disable a group
- `schedule_manager.set_active_schedule`: Set active schedule in exclusive group
- `schedule_manager.set_override`: Set temporary override
- `schedule_manager.clear_override`: Clear override

## Entities

- Sensor: `sensor.schedule_manager_status`
- Switch: `switch.schedule_manager_enabled`