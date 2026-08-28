import type { BlockAction, Schedule, TimeBlock } from './types';

function randomActionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newEmptyAction(): BlockAction {
  return {
    id: randomActionId(),
    action_type: '',
    action_payload: {},
  };
}

/** Normalise une plage depuis le stockage HA (tableau `actions` ou ancien format plat). */
export function normalizeTimeBlock(raw: Record<string, unknown>): TimeBlock {
  const start_time = String(raw.start_time ?? '00:00:00');
  const end_time = String(raw.end_time ?? '23:59:59');
  const id = typeof raw.id === 'string' ? raw.id : undefined;

  const actionsRaw = raw.actions;
  if (Array.isArray(actionsRaw) && actionsRaw.length > 0) {
    const actions: BlockAction[] = actionsRaw.map((a, i) => {
      const rec = a as Record<string, unknown>;
      return {
        id: typeof rec.id === 'string' ? rec.id : `${randomActionId()}-${i}`,
        action_type: String(rec.action_type ?? ''),
        action_payload:
          typeof rec.action_payload === 'object' && rec.action_payload !== null
            ? rec.action_payload
            : {},
      };
    });
    return { id, start_time, end_time, actions };
  }

  return {
    id,
    start_time,
    end_time,
    actions: [
      {
        id: randomActionId(),
        action_type: String(raw.action_type ?? ''),
        action_payload:
          typeof raw.action_payload === 'object' && raw.action_payload !== null
            ? raw.action_payload
            : {},
      },
    ],
  };
}

export function normalizeScheduleTimeBlocks(schedule: Schedule): Schedule {
  return {
    ...schedule,
    time_blocks: (schedule.time_blocks || []).map((tb) =>
      normalizeTimeBlock(tb as unknown as Record<string, unknown>)
    ),
  };
}

export function blockHasConfiguredAction(block: TimeBlock): boolean {
  return (block.actions || []).some((a) => Boolean(String(a.action_type ?? '').trim()));
}
