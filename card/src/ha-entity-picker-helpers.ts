/**
 * HA ≥ 2024 : `ha-entity-picker.entityFilter` reçoit un `HassEntity` (objet avec `entity_id`),
 * pas uniquement une chaîne `entity_id`.
 */
export function entityIdFromPickerFilterArgument(raw: unknown): string {
  if (typeof raw === 'string' && raw.includes('.')) {
    return raw;
  }
  if (raw && typeof raw === 'object' && 'entity_id' in raw) {
    const id = (raw as { entity_id?: unknown }).entity_id;
    if (typeof id === 'string' && id.includes('.')) {
      return id;
    }
  }
  return '';
}
