import type { HomeAssistant } from './types';

/**
 * Déduit les domaines d’entités « compatibles » avec un type d’action HA.
 * Si `domain.service` est fourni, un seul domaine ; sinon heuristiques pour les noms de service seuls.
 */
export function domainsForActionType(actionType: string): string[] {
  const t = actionType.trim().toLowerCase();
  if (!t) {
    return [];
  }
  if (t.includes('.')) {
    const dom = t.split('.')[0];
    return dom ? [dom] : [];
  }

  const map: Record<string, string[]> = {
    set_preset_mode: ['climate'],
    set_temperature: ['climate'],
    set_hvac_mode: ['climate'],
    turn_on: ['switch', 'light', 'climate', 'input_boolean', 'group', 'fan'],
    turn_off: ['switch', 'light', 'climate', 'input_boolean', 'group', 'fan'],
    toggle: ['switch', 'light', 'input_boolean'],
    open_cover: ['cover'],
    close_cover: ['cover'],
    set_cover_position: ['cover'],
    stop_cover: ['cover'],
    lock: ['lock'],
    unlock: ['lock'],
    alarm_arm_home: ['alarm_control_panel'],
    alarm_arm_away: ['alarm_control_panel'],
    alarm_disarm: ['alarm_control_panel'],
  };

  return map[t] ?? [];
}

export function entityMatchesDomains(entityId: string, domains: string[]): boolean {
  if (!domains.length) {
    return true;
  }
  const dom = entityId.split('.')[0];
  return domains.includes(dom);
}

function isClimateSetPresetModeAction(actionType: string): boolean {
  const t = String(actionType ?? '').trim().toLowerCase();
  if (t === 'set_preset_mode') {
    return true;
  }
  return t === 'climate.set_preset_mode';
}

function isClimateSetHvacModeAction(actionType: string): boolean {
  const t = String(actionType ?? '').trim().toLowerCase();
  if (t === 'set_hvac_mode') {
    return true;
  }
  return t === 'climate.set_hvac_mode';
}

/**
 * Liste des modes préréglés exposés par HA pour cette entité climate, ou `null` si aucune
 * liste exploitable (même règle que le filtre `climate.set_preset_mode`).
 */
export function climatePresetModesList(
  hass: HomeAssistant,
  entityId: string
): string[] | null {
  if (!entityId.startsWith('climate.')) {
    return null;
  }
  const pm = hass.states[entityId]?.attributes?.preset_modes;
  if (Array.isArray(pm) && pm.length && pm.every((x): x is string => typeof x === 'string')) {
    return pm;
  }
  return null;
}

/**
 * Climat dont HA expose au moins un `preset_modes` utilisable (même critère que l’étape
 * « mode préréglé » de l’assistant : sans liste non vide, `set_preset_mode` n’a pas de sens).
 */
export function climateEntityHasPresetModes(
  hass: HomeAssistant,
  entityId: string
): boolean {
  return climatePresetModesList(hass, entityId) !== null;
}

/** Climat avec `hvac_modes` non vide et typé comme attendu par HA. */
export function climateEntityHasHvacModes(
  hass: HomeAssistant,
  entityId: string
): boolean {
  if (!entityId.startsWith('climate.')) {
    return false;
  }
  const hm = hass.states[entityId]?.attributes?.hvac_modes;
  if (!Array.isArray(hm) || hm.length === 0) {
    return false;
  }
  return hm.every((x): x is string => typeof x === 'string');
}

/**
 * Indique si une entité peut être associée à une action `domain.service`.
 * Comportement strict : si la carte ne connaît pas le service, on se rabat sur l’égalité
 * du domaine de l’entité avec le domaine du service (jamais « tout autoriser »).
 *
 * @param hass — si fourni, filtres supplémentaires pour certains services climate
 *   (listes `preset_modes` / `hvac_modes` présentes et non vides).
 */
export function entityCompatibleWithAction(
  entityId: string,
  actionType: string,
  hass?: HomeAssistant
): boolean {
  if (!entityId.includes('.')) {
    return false;
  }
  const entityDom = entityId.split('.')[0] ?? '';
  const t = String(actionType ?? '').trim().toLowerCase();
  if (!t) {
    return false;
  }

  let baseOk = false;
  const compat = domainsForActionType(t);
  if (compat.length > 0) {
    baseOk = compat.includes(entityDom);
  } else {
    const firstDot = t.indexOf('.');
    if (firstDot > 0) {
      const serviceDomain = t.slice(0, firstDot);
      baseOk = entityDom === serviceDomain;
    }
  }

  if (!baseOk) {
    return false;
  }

  if (hass && entityDom === 'climate') {
    if (isClimateSetPresetModeAction(t)) {
      return climateEntityHasPresetModes(hass, entityId);
    }
    if (isClimateSetHvacModeAction(t)) {
      return climateEntityHasHvacModes(hass, entityId);
    }
  }

  return true;
}
