import type { CardConfig } from './types';

export interface ResolveOrderedScheduleIdsOptions {
  /** Faux dans l’éditeur : liste complète pour cocher/décocher ; vrai sur la carte (défaut). */
  applyVisibilityFilter?: boolean;
}

/** Ordre d’affichage ; sur la carte, filtre aussi par `schedule_ids` si défini. */
export function resolveOrderedScheduleIds(
  config: Pick<CardConfig, 'schedule_ids' | 'schedule_order'>,
  availableIds: string[],
  compareIds: (a: string, b: string) => number,
  options: ResolveOrderedScheduleIdsOptions = {}
): string[] {
  const applyVisibilityFilter = options.applyVisibilityFilter !== false;
  const available = new Set(availableIds);
  const filter = (config.schedule_ids ?? [])
    .map((id) => String(id).trim())
    .filter((id) => id && available.has(id));
  const pool =
    applyVisibilityFilter && filter.length > 0
      ? filter
      : availableIds.filter((id) => available.has(id));

  const explicitOrder = (config.schedule_order ?? [])
    .map((id) => String(id).trim())
    .filter((id) => pool.includes(id));

  const ordered: string[] = [];
  for (const id of explicitOrder) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }
  const remainder = pool.filter((id) => !ordered.includes(id));
  remainder.sort(compareIds);
  return [...ordered, ...remainder];
}
