import type { HomeAssistant, TimeBlockServicePayload } from './types';

export class ScheduleManagerServices {
  constructor(private hass: HomeAssistant) {}

  async callService(domain: string, service: string, data: Record<string, unknown>) {
    await this.hass.callService(domain, service, data);
  }

  async enableSchedule(scheduleId: string) {
    await this.callService('schedule_manager', 'enable_schedule', { schedule_id: scheduleId });
  }

  async disableSchedule(scheduleId: string) {
    await this.callService('schedule_manager', 'disable_schedule', { schedule_id: scheduleId });
  }

  async createSchedule(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    await this.callService('schedule_manager', 'create_schedule', { name: trimmed });
  }

  async deleteSchedule(scheduleId: string) {
    await this.callService('schedule_manager', 'delete_schedule', { schedule_id: scheduleId });
  }

  async updateSchedule(
    scheduleId: string,
    updates: {
      name?: string;
      enabled?: boolean;
      repeat_days?: number[];
      time_blocks?: TimeBlockServicePayload[];
    }
  ) {
    const data: Record<string, unknown> = { schedule_id: scheduleId };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    if (updates.repeat_days !== undefined) data.repeat_days = updates.repeat_days;
    if (updates.time_blocks !== undefined) data.time_blocks = updates.time_blocks;
    await this.callService('schedule_manager', 'update_schedule', data);
  }
}
