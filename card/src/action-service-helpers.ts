import type { HomeAssistant } from './types';

export interface ParsedDomainService {
  domain: string;
  service: string;
}

/** Décompose `climate.set_preset_mode` → domain + nom court du service. */
export function parseDomainService(actionType: string): ParsedDomainService | null {
  const t = actionType.trim();
  if (!t.includes('.')) {
    return null;
  }
  const i = t.indexOf('.');
  const domain = t.slice(0, i).trim();
  const service = t.slice(i + 1).trim();
  if (!domain || !service) {
    return null;
  }
  return { domain, service };
}

/** Entités « hass.services » exposées par Lovelace (schéma HA). */
export function servicesForDomain(
  hass: HomeAssistant,
  domain: string
): string[] {
  const raw = hass.services?.[domain];
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  return Object.keys(raw).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

/** Service par défaut raisonnable quand le domaine ou l’entité change. */
export function pickDefaultService(domain: string, available: string[]): string {
  if (!available.length) {
    return 'turn_on';
  }
  const prefs: Record<string, string> = {
    climate: 'set_preset_mode',
    light: 'turn_on',
    switch: 'turn_on',
    fan: 'turn_on',
    cover: 'open_cover',
    lock: 'lock',
    alarm_control_panel: 'alarm_arm_home',
    input_boolean: 'turn_on',
    input_select: 'select_option',
    media_player: 'media_play',
    vacuum: 'start',
    water_heater: 'set_temperature',
    humidifier: 'set_humidity',
  };
  const pref = prefs[domain];
  if (pref && available.includes(pref)) {
    return pref;
  }
  const first = available[0];
  return first ?? 'turn_on';
}

/** Garde uniquement `entity_id` et la couleur d’affichage (réinitialise le reste au changement de service). */
export function stripPayloadForNewService(
  prevPayload: unknown,
  entityId: string | undefined,
  colorKey: string
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (entityId) {
    out.entity_id = entityId;
  }
  if (
    prevPayload &&
    typeof prevPayload === 'object' &&
    !Array.isArray(prevPayload)
  ) {
    const c = (prevPayload as Record<string, unknown>)[colorKey];
    if (typeof c === 'string') {
      out[colorKey] = c;
    }
  }
  return out;
}

/** Préréglages utiles quand on arrive sur certains services courants. */
export function applyDefaultFieldsForService(
  domain: string,
  service: string,
  entityId: string,
  payload: Record<string, unknown>,
  hass: HomeAssistant
): void {
  if (domain === 'climate' && service === 'set_preset_mode') {
    if (payload.preset_mode !== undefined) {
      return;
    }
    const st = hass.states[entityId];
    const modes = st?.attributes?.preset_modes;
    if (Array.isArray(modes) && modes.length && typeof modes[0] === 'string') {
      payload.preset_mode = modes[0];
    } else {
      payload.preset_mode = 'comfort';
    }
    return;
  }
  if (
    (domain === 'light' || domain === 'switch') &&
    (service === 'turn_on' || service === 'toggle')
  ) {
    /* rien d’obligatoire */
  }
}
