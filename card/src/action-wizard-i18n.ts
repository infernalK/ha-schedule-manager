import type { HomeAssistant } from './types';
import { collatorLocale, domainLabel } from './i18n';
import { parseDomainService } from './action-service-helpers';
import { domainsForActionType, entityCompatibleWithAction } from './entity-domains';

export function domainIcon(domain: string): string {
  const map: Record<string, string> = {
    alarm_control_panel: 'mdi:shield-home',
    automation: 'mdi:robot',
    binary_sensor: 'mdi:toggle-switch',
    button: 'mdi:gesture-tap-button',
    camera: 'mdi:cctv',
    climate: 'mdi:thermostat',
    cover: 'mdi:window-open',
    fan: 'mdi:fan',
    humidifier: 'mdi:air-humidifier',
    input_boolean: 'mdi:toggle-switch-outline',
    input_button: 'mdi:gesture-tap',
    input_number: 'mdi:numeric',
    input_select: 'mdi:format-list-bulleted',
    input_text: 'mdi:form-textbox',
    light: 'mdi:lightbulb',
    lock: 'mdi:lock',
    media_player: 'mdi:speaker',
    number: 'mdi:numeric',
    scene: 'mdi:palette',
    script: 'mdi:script-text',
    select: 'mdi:format-list-checkbox',
    sensor: 'mdi:eye',
    switch: 'mdi:light-switch',
    vacuum: 'mdi:robot-vacuum',
    valve: 'mdi:pipe-valve',
    water_heater: 'mdi:water-boiler',
    weather: 'mdi:weather-partly-cloudy',
  };
  return map[domain] ?? 'mdi:shape-outline';
}

export function serviceSecondaryHint(domain: string, service: string): string {
  return `${domain}.${service}`;
}

export function friendlyEntityName(hass: HomeAssistant, entityId: string): string {
  const fn = hass.states[entityId]?.attributes?.friendly_name;
  return typeof fn === 'string' && fn.trim() ? fn.trim() : entityId;
}

export function entityIcon(hass: HomeAssistant, entityId: string): string | undefined {
  const ic = hass.states[entityId]?.attributes?.icon;
  return typeof ic === 'string' ? ic : undefined;
}

/** Domaines ayant au moins une entité et des services HA connus. */
export function listSelectableDomains(hass: HomeAssistant): string[] {
  const svc = hass.services || {};
  const doms = new Set<string>();
  for (const eid of Object.keys(hass.states)) {
    const d = eid.includes('.') ? eid.split('.')[0] ?? '' : '';
    if (!d || !svc[d] || Object.keys(svc[d]).length === 0) {
      continue;
    }
    doms.add(d);
  }
  return [...doms].sort((a, b) =>
    domainLabel(hass, a).localeCompare(domainLabel(hass, b), collatorLocale(hass), {
      sensitivity: 'base',
    })
  );
}

export function listEntitiesInDomain(hass: HomeAssistant, domain: string): string[] {
  const prefix = `${domain}.`;
  return Object.keys(hass.states)
    .filter((id) => id.startsWith(prefix))
    .sort((a, b) =>
      friendlyEntityName(hass, a).localeCompare(friendlyEntityName(hass, b), collatorLocale(hass), {
        sensitivity: 'base',
      })
    );
}

/**
 * Identifiants d’entités proposés pour une action `domain.service` (même logique que l’assistant
 * « Choisir une action » : domaine(s) du service + filtre de compatibilité).
 */
export function listEntityIdsForAction(hass: HomeAssistant, actionType: string): string[] {
  const t = actionType.trim().toLowerCase();
  if (!t) {
    return [];
  }
  const parsed = parseDomainService(t);
  if (parsed) {
    return listEntitiesInDomain(hass, parsed.domain).filter((eid) =>
      entityCompatibleWithAction(eid, t, hass)
    );
  }
  const doms = domainsForActionType(t);
  if (!doms.length) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of doms) {
    for (const eid of listEntitiesInDomain(hass, d)) {
      if (seen.has(eid)) {
        continue;
      }
      if (entityCompatibleWithAction(eid, t, hass)) {
        seen.add(eid);
        out.push(eid);
      }
    }
  }
  out.sort((a, b) =>
    friendlyEntityName(hass, a).localeCompare(friendlyEntityName(hass, b), collatorLocale(hass), {
      sensitivity: 'base',
    })
  );
  return out;
}
