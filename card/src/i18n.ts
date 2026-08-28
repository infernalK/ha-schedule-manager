/**
 * Internationalisation : langue = hass.locale.language (BCP‑47), défaut anglais si non pris en charge.
 */
import type { HomeAssistant } from './types';

const SUPPORTED = new Set(['en', 'fr']);

export function normalizeLang(raw: string | undefined): 'en' | 'fr' {
  if (!raw || typeof raw !== 'string') {
    return 'en';
  }
  const base = raw.split(/[-_]/)[0]?.toLowerCase() ?? 'en';
  return SUPPORTED.has(base) ? (base as 'en' | 'fr') : 'en';
}

export function collatorLocale(hass: HomeAssistant | undefined): string {
  return normalizeLang(hass?.locale?.language) === 'fr' ? 'fr' : 'en';
}

const DOMAIN_LABELS: Record<'en' | 'fr', Record<string, string>> = {
  en: {
    alarm_control_panel: 'Alarm',
    automation: 'Automation',
    binary_sensor: 'Binary sensor',
    button: 'Button',
    camera: 'Camera',
    climate: 'Climate',
    cover: 'Cover',
    fan: 'Fan',
    humidifier: 'Humidifier',
    input_boolean: 'Input boolean',
    input_button: 'Input button',
    input_number: 'Input number',
    input_select: 'Input select',
    input_text: 'Input text',
    light: 'Light',
    lock: 'Lock',
    media_player: 'Media player',
    number: 'Number',
    scene: 'Scene',
    script: 'Script',
    select: 'Select',
    sensor: 'Sensor',
    switch: 'Switch',
    sun: 'Sun',
    update: 'Update',
    vacuum: 'Vacuum',
    valve: 'Valve',
    water_heater: 'Water heater',
    weather: 'Weather',
    zone: 'Zone',
  },
  fr: {
    alarm_control_panel: 'Alarme',
    automation: 'Automatisation',
    binary_sensor: 'Capteur binaire',
    button: 'Bouton',
    camera: 'Caméra',
    climate: 'Climat',
    cover: 'Volet / store',
    fan: 'Ventilateur',
    humidifier: 'Humidificateur',
    input_boolean: 'Interrupteur virtuel',
    input_button: 'Bouton virtuel',
    input_number: 'Nombre',
    input_select: 'Liste déroulante',
    input_text: 'Texte',
    light: 'Lumière',
    lock: 'Serrure',
    media_player: 'Média',
    number: 'Nombre',
    scene: 'Scène',
    script: 'Script',
    select: 'Liste',
    sensor: 'Capteur',
    switch: 'Interrupteur',
    sun: 'Soleil',
    update: 'Mise à jour',
    vacuum: 'Aspirateur',
    valve: 'Vanne',
    water_heater: 'Chauffe-eau',
    weather: 'Météo',
    zone: 'Zone',
  },
};

const SERVICE_PRIMARY: Record<'en' | 'fr', Record<string, string>> = {
  en: {
    'climate.turn_on': 'Turn on',
    'climate.turn_off': 'Turn off',
    'climate.toggle': 'Toggle',
    'climate.set_preset_mode': 'Set preset mode',
    'climate.set_temperature': 'Set temperature',
    'climate.set_hvac_mode': 'Set HVAC mode',
    'climate.set_fan_mode': 'Set fan mode',
    'light.turn_on': 'Turn on',
    'light.turn_off': 'Turn off',
    'light.toggle': 'Toggle',
    'switch.turn_on': 'Turn on',
    'switch.turn_off': 'Turn off',
    'switch.toggle': 'Toggle',
    'fan.turn_on': 'Turn on',
    'fan.turn_off': 'Turn off',
    'cover.open_cover': 'Open',
    'cover.close_cover': 'Close',
    'cover.stop_cover': 'Stop',
    'cover.set_cover_position': 'Set position',
    'lock.lock': 'Lock',
    'lock.unlock': 'Unlock',
    'media_player.media_play': 'Play',
    'media_player.media_pause': 'Pause',
    'media_player.turn_on': 'Turn on',
    'media_player.turn_off': 'Turn off',
    'vacuum.start': 'Start',
    'vacuum.pause': 'Pause',
    'vacuum.return_to_base': 'Return to base',
    'script.turn_on': 'Run',
    'scene.turn_on': 'Activate scene',
    'input_boolean.turn_on': 'Turn on',
    'input_boolean.turn_off': 'Turn off',
    'input_boolean.toggle': 'Toggle',
    'humidifier.set_humidity': 'Set humidity',
    'humidifier.turn_on': 'Turn on',
    'humidifier.turn_off': 'Turn off',
    'water_heater.set_temperature': 'Set temperature',
  },
  fr: {
    'climate.turn_on': 'Allumer',
    'climate.turn_off': 'Éteindre',
    'climate.toggle': 'Basculer',
    'climate.set_preset_mode': 'Choisir un mode préréglé',
    'climate.set_temperature': 'Régler la température',
    'climate.set_hvac_mode': 'Régler le mode HVAC',
    'climate.set_fan_mode': 'Régler le mode ventilation',
    'light.turn_on': 'Allumer',
    'light.turn_off': 'Éteindre',
    'light.toggle': 'Basculer',
    'switch.turn_on': 'Allumer',
    'switch.turn_off': 'Éteindre',
    'switch.toggle': 'Basculer',
    'fan.turn_on': 'Allumer',
    'fan.turn_off': 'Éteindre',
    'cover.open_cover': 'Ouvrir',
    'cover.close_cover': 'Fermer',
    'cover.stop_cover': 'Arrêter',
    'cover.set_cover_position': 'Régler la position',
    'lock.lock': 'Verrouiller',
    'lock.unlock': 'Déverrouiller',
    'media_player.media_play': 'Lecture',
    'media_player.media_pause': 'Pause',
    'media_player.turn_on': 'Allumer',
    'media_player.turn_off': 'Éteindre',
    'vacuum.start': 'Démarrer',
    'vacuum.pause': 'Pause',
    'vacuum.return_to_base': 'Retour à la base',
    'script.turn_on': 'Exécuter',
    'scene.turn_on': 'Activer la scène',
    'input_boolean.turn_on': 'Activer',
    'input_boolean.turn_off': 'Désactiver',
    'input_boolean.toggle': 'Basculer',
    'humidifier.set_humidity': 'Régler l’humidité',
    'humidifier.turn_on': 'Allumer',
    'humidifier.turn_off': 'Éteindre',
    'water_heater.set_temperature': 'Régler la température',
  },
};

/** Libellé de domaine (liste assistant, etc.). */
export function domainLabel(hass: HomeAssistant | undefined, domain: string): string {
  const lang = normalizeLang(hass?.locale?.language);
  return (
    DOMAIN_LABELS[lang][domain] ??
    DOMAIN_LABELS.en[domain] ??
    domain.replace(/_/g, ' ')
  );
}

/** Titre principal pour une ligne de service dans l’assistant. */
export function servicePrimaryLabel(
  hass: HomeAssistant | undefined,
  domain: string,
  service: string
): string {
  const lang = normalizeLang(hass?.locale?.language);
  const k = `${domain}.${service}`;
  const known = SERVICE_PRIMARY[lang][k] ?? SERVICE_PRIMARY.en[k];
  if (known) {
    return known;
  }
  const t = service.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const MESSAGES: Record<'en' | 'fr', Record<string, string>> = {
  en: {
    'card.loading': 'Loading…',
    'card.entity_missing': 'Entity not found:',
    'card.empty_filter_schedules':
      'No schedule matches the schedule_ids on this card. Check the UUIDs in the sensor schedules attribute.',
    'card.empty_no_schedules':
      'No schedules yet. Create one below or via Developer tools → Actions:',
    'card.empty_no_schedules_service': '(the `name` field is required).',
    'card.placeholder_schedule_name': 'Schedule name (e.g. Weekday)',
    'card.creating': 'Creating…',
    'card.create_schedule': 'Create schedule',
    'card.empty_list': 'Nothing to display.',
    'card.configure_slots': 'Configure time slots…',
    'card.no_slots_hint': 'No time slots — use “Configure time slots…” to add some.',
    'card.open_schedule_editor_aria': 'Open editor for {name}',
    'card.compact_empty_hint':
      'No time slots yet — click this area to add slots and configure block actions.',
    'card.timeline_aria': 'Time slots over 24 hours',
    'card.default_header_title': 'Schedule Manager',
    'card.alert_select_day': 'Select at least one day.',
    'card.alert_end_after_start':
      'For a same-day slot, end time must be strictly after start time.',
    'card.alert_overlap': 'Time slots cannot overlap.',
    'card.alert_min_one_action': 'Each slot must keep at least one action.',
    'card.alert_cannot_add_overlap':
      'Cannot add this slot without overlap. Change existing times first.',
    'card.alert_day_full':
      'The day is already fully covered. Remove or shorten a slot before adding another.',
    'card.alert_duplicate_slot': 'An identical slot already exists — change times or service.',
    'card.alert_min_one_entity':
      'Keep at least one entity, or use “Edit action” to reconfigure everything.',
    'card.entity_search_aria': 'Search entities',
    'card.entity_search_placeholder': 'Search entities',
    'card.entity_list_aria': 'Compatible entities',
    'card.entity_manual_empty': 'No compatible entities{q}. Check the action type or use “Edit action”.',
    'card.entity_manual_empty_q': ' for this search',
    'card.wizard_no_results': 'No results.',
    'card.wizard_no_services_domain': 'No services for this domain.',
    'card.wizard_no_entities':
      'No entity compatible with action {action} in this domain.',
    'card.wizard_no_presets':
      'No preset modes for this entity. Use Back or close.',
    'card.wizard_preset_sub': 'Preset mode · climate.set_preset_mode',
    'card.wizard_step1': 'Step 1 — choose a device type (domain)',
    'card.wizard_step2': 'Step 2 — which action for domain',
    'card.wizard_step2_suffix': ' ?',
    'card.wizard_step3': 'Step 3 — which entity for',
    'card.wizard_step3_suffix': '? Only compatible entities are listed.',
    'card.wizard_step4': 'Step 4 — preset mode for «{name}»',
    'card.wizard_title': 'Choose an action',
    'card.wizard_back': 'Back',
    'card.wizard_close': 'Close',
    'card.wizard_search_placeholder': 'Search',
    'card.wizard_search_aria': 'Filter list',
    'card.choose_action_btn': '+ Choose an action',
    'card.actions_list_aria': 'Actions in this slot',
    'card.action_tab_fallback': 'Action {n}',
    'card.remove_action_aria': 'Remove this action',
    'card.remove_action_title': 'Remove this action',
    'card.remove': 'Remove',
    'card.target_entities_title': 'Target entities',
    'card.replace_entity': 'Replace entity',
    'card.replace_entity_chip_aria': 'Replace {name}',
    'card.close_picker_aria': 'Close picker',
    'card.add_entity_heading': 'Add entity',
    'card.close_entity_picker_aria': 'Close entity picker',
    'card.add_entity_title': 'Choose an entity to add',
    'card.add_entity_aria': 'Add entity',
    'card.custom_action': 'Custom action:',
    'card.preset_mode_label': 'Preset mode',
    'card.validation_min_action':
      'Each slot must have at least one action with a defined service (use “Choose an action”).',
    'card.validation_duplicate': 'Two identical slots (times + action + payload) — edit entry no. {n}.',
    'card.validation_overlap_day': 'Slots overlap on the same day. Fix times before saving.',
    'card.color_field_title': 'Slot colour on the timeline',
    'card.color_system_title': 'Open the system colour picker',
    'card.color_system_aria': 'Pick a precise colour with the browser colour picker',
    'card.color_default': 'Default',
    'card.editor_timeline_aria': '24-hour slots — click to select, handles to adjust',
    'card.drag_move_slot': '{label} — drag to move the slot',
    'card.handle_start': 'Move slot start',
    'card.handle_end': 'Move slot end',
    'card.handle_junction': 'Drag to move the transition',
    'card.handle_start_time': 'Drag to change start time',
    'card.modal_close': '×',
    'card.repeat_days': 'Repeat days',
    'card.repeat_days_all_short': 'Every day',
    'card.repeat_days_row_aria': 'Repeat days for this schedule',
    'card.no_slots_editor': 'No slots — use “+ Add slot” above.',
    'card.start_time_label': 'Start time (HH:MM)',
    'card.no_entity_selected': 'No entity selected',
    'editor.loading': 'Loading dashboard…',
    'editor.card_title_section': 'Card title',
    'editor.show_title_switch': 'Show title on card',
    'editor.custom_title_optional': 'Custom title (optional)',
    'editor.title_apply_hint':
      'Enter text then click outside the field (or Tab) to apply to configuration. Empty =',
    'editor.title_disabled_hint': 'Turn “Show title on card” back on to edit the label.',
    'editor.schedule_toggle_label': 'Per-schedule on/off switch',
    'editor.schedule_toggle_hint':
      'Shows or hides the switch to the right of each schedule name (integration side).',
    'editor.show_repeat_days_on_card_label': 'Show repeat days on the card',
    'editor.show_repeat_days_on_card_hint':
      'When enabled, each schedule shows which weekdays it runs (below the title, above the 24-hour bar).',
    'editor.show_slots_on_card_label': 'Show “Configure time slots” link under the timeline',
    'editor.show_slots_on_card_hint':
      'When off, only the link is hidden; the 24-hour bar stays visible. Use the option below to allow opening the editor by clicking the schedule.',
    'editor.card_click_opens_editor_label': 'Click on schedule opens editor',
    'editor.card_click_opens_editor_hint':
      'Only when the link above is off. If this is off too, turn one of the two switches above back on to edit from the dashboard.',
    'editor.entity_missing_no_picker':
      'Sensor `{id}` was not found. Load the Schedule Manager integration or set `status_entity` in YAML.',
    'editor.schedules_on_card_title': 'Schedules to show on the card',
    'editor.schedules_on_card_hint':
      'All boxes checked = show every schedule. Uncheck to hide one (at least one stays visible).',
    'editor.schedules_order_hint':
      'Use ↑ ↓ to set the display order on the dashboard card.',
    'editor.move_schedule_up_aria': 'Move {name} up',
    'editor.move_schedule_down_aria': 'Move {name} down',
    'editor.no_schedules_hint':
      'No schedules in the sensor attributes yet. Create one from the card or the {service} service.',
    'card.save_failed_prefix': 'Could not save:',
    'card.actions_during_slot': 'Actions during this time slot',
    'card.remove_slot': 'Remove slot',
    'card.add_slot': '+ Add slot',
    'card.cancel': 'Cancel',
    'card.save': 'Save',
    'card.end_time_label': 'End time (HH:MM)',
    'card.edit_action': 'Edit action',
    'card.add_another_action': '+ Add another action',
    'card.preset_current_suffix': ' (current)',
    'card.color_browser_picker_short': 'Browser colour picker',
    'card.color_apply_aria': 'Apply colour {hex}',
    'card.time_axis_label': 'Time',
    'card.close_overlay_aria': 'Close',
    'card.remove_entity_aria': 'Remove {name}',
    'card.resize_aria_junction': 'Adjust the transition between two slots',
    'card.resize_title_junction': 'Drag to move the transition',
    'card.resize_aria_start': 'Move slot start',
    'card.resize_title_start': 'Drag to change start time',
    'card.resize_aria_end': 'Move slot end',
    'card.resize_title_end': 'Drag to change end time',
  },
  fr: {
    'card.loading': 'Chargement…',
    'card.entity_missing': 'Entité introuvable :',
    'card.empty_filter_schedules':
      'Aucun planning ne correspond aux schedule_ids de la carte. Vérifiez les UUID dans l’attribut schedules du capteur.',
    'card.empty_no_schedules':
      'Aucun planning enregistré pour l’instant. Créez-en un ci-dessous ou via Outils de développement → Actions :',
    'card.empty_no_schedules_service': '(champ `name` obligatoire).',
    'card.placeholder_schedule_name': 'Nom du planning (ex. Semaine)',
    'card.creating': 'Création…',
    'card.create_schedule': 'Créer le planning',
    'card.empty_list': 'Aucun élément à afficher.',
    'card.configure_slots': 'Configurer les plages…',
    'card.no_slots_hint':
      'Aucune plage — utilisez « Configurer les plages… » pour définir des créneaux.',
    'card.open_schedule_editor_aria': 'Ouvrir l’éditeur pour {name}',
    'card.compact_empty_hint':
      'Aucune plage pour l’instant — cliquez sur cette zone pour ajouter des créneaux et configurer les actions des blocs.',
    'card.timeline_aria': 'Plages sur 24 heures',
    'card.default_header_title': 'Schedule Manager',
    'card.alert_select_day': 'Sélectionnez au moins un jour.',
    'card.alert_end_after_start':
      'Pour une plage sur une même journée, l’heure de fin doit être strictement après le début.',
    'card.alert_overlap': 'Les plages horaires ne peuvent pas se chevaucher.',
    'card.alert_min_one_action': 'Chaque plage doit conserver au moins une action.',
    'card.alert_cannot_add_overlap':
      'Impossible d’ajouter cette plage sans chevauchement. Modifiez les horaires existants.',
    'card.alert_day_full':
      'La journée est déjà entièrement couverte. Supprimez ou raccourcissez une plage avant d’en ajouter une autre.',
    'card.alert_duplicate_slot':
      'Une plage identique existe déjà — modifiez les horaires ou le service.',
    'card.alert_min_one_entity':
      'Conservez au moins une entité, ou utilisez « Modifier l’action » pour tout reconfigurer.',
    'card.entity_search_aria': 'Rechercher des entités',
    'card.entity_search_placeholder': 'Rechercher des entités',
    'card.entity_list_aria': 'Entités compatibles',
    'card.entity_manual_empty':
      'Aucune entité compatible{q}. Vérifiez le type d’action ou utilisez « Modifier l’action ».',
    'card.entity_manual_empty_q': ' pour cette recherche',
    'card.wizard_no_results': 'Aucun résultat.',
    'card.wizard_no_services_domain': 'Aucun service pour ce domaine.',
    'card.wizard_no_entities':
      'Aucune entité compatible avec l’action {action} dans ce domaine.',
    'card.wizard_no_presets':
      'Aucun mode préréglé trouvé pour cette entité. Utilisez Retour ou fermez.',
    'card.wizard_preset_sub': 'Mode préréglé · climate.set_preset_mode',
    'card.wizard_step1': 'Étape 1 — choisissez un type d’appareil (domaine)',
    'card.wizard_step2': 'Étape 2 — quelle action · domaine',
    'card.wizard_step2_suffix': ' ?',
    'card.wizard_step3': 'Étape 3 — quelle entité pour',
    'card.wizard_step3_suffix': ' ? Seules les entités compatibles sont listées.',
    'card.wizard_step4': 'Étape 4 — mode préréglé pour « {name} »',
    'card.wizard_title': 'Choisir une action',
    'card.wizard_back': 'Retour',
    'card.wizard_close': 'Fermer',
    'card.wizard_search_placeholder': 'Rechercher',
    'card.wizard_search_aria': 'Filtrer la liste',
    'card.choose_action_btn': '+ Choisir une action',
    'card.actions_list_aria': 'Liste des actions du créneau',
    'card.action_tab_fallback': 'Action {n}',
    'card.remove_action_aria': 'Supprimer cette action',
    'card.remove_action_title': 'Supprimer cette action',
    'card.remove': 'Supprimer',
    'card.target_entities_title': 'Entités ciblées',
    'card.replace_entity': 'Remplacer l’entité',
    'card.replace_entity_chip_aria': 'Remplacer {name}',
    'card.close_picker_aria': 'Fermer le sélecteur',
    'card.add_entity_heading': 'Ajouter une entité',
    'card.close_entity_picker_aria': 'Fermer le sélecteur d’entité',
    'card.add_entity_title': 'Choisir une entité à ajouter',
    'card.add_entity_aria': 'Ajouter une entité',
    'card.custom_action': 'Action personnalisée :',
    'card.preset_mode_label': 'Mode préréglé',
    'card.validation_min_action':
      'Chaque plage doit avoir au moins une action avec un service défini (assistant « Choisir une action »).',
    'card.validation_duplicate':
      'Deux plages identiques (horaires + action + payload) — modifiez l’entrée n° {n}.',
    'card.validation_overlap_day':
      'Des plages se chevauchent sur la journée. Corrigez les horaires avant d’enregistrer.',
    'card.color_field_title': 'Couleur du créneau sur la ligne horaire',
    'card.color_system_title': 'Ouvrir le sélecteur de couleur du système',
    'card.color_system_aria': 'Choisir une couleur précise avec le nuancier du navigateur',
    'card.color_default': 'Défaut',
    'card.editor_timeline_aria':
      'Plages sur 24 heures — cliquer pour sélectionner, poignées pour ajuster',
    'card.drag_move_slot': '{label} — glisser pour déplacer la plage',
    'card.handle_start': 'Déplacer le début de la plage',
    'card.handle_end': 'Déplacer la fin de la plage',
    'card.handle_junction': 'Glisser pour déplacer la transition',
    'card.handle_start_time': 'Glisser pour modifier l’heure de début',
    'card.modal_close': '×',
    'card.repeat_days': 'Jours de répétition',
    'card.repeat_days_all_short': 'Tous les jours',
    'card.repeat_days_row_aria': 'Jours de répétition pour ce planning',
    'card.no_slots_editor': 'Aucune plage — utilisez « + Ajouter une plage » ci-dessus.',
    'card.start_time_label': 'Heure de début (HH:MM)',
    'card.no_entity_selected': 'Aucune entité sélectionnée',
    'editor.loading': 'Chargement du tableau de bord…',
    'editor.card_title_section': 'Titre de la carte',
    'editor.show_title_switch': 'Afficher le titre sur la carte',
    'editor.custom_title_optional': 'Titre personnalisé (optionnel)',
    'editor.title_apply_hint':
      'Saisissez le texte puis cliquez en dehors du champ (ou Tab) pour l’appliquer à la configuration. Vide =',
    'editor.title_disabled_hint':
      'Réactivez « Afficher le titre sur la carte » pour modifier le libellé.',
    'editor.schedule_toggle_label': 'Interrupteur actif / inactif par planning',
    'editor.schedule_toggle_hint':
      'Affiche ou masque le commutateur à droite du nom de chaque planning (activation côté intégration).',
    'editor.show_repeat_days_on_card_label': 'Afficher les jours de répétition sur la carte',
    'editor.show_repeat_days_on_card_hint':
      'Si activé, chaque planning indique les jours de la semaine concernés (sous le titre, au-dessus de la frise horaire).',
    'editor.show_slots_on_card_label':
      'Afficher le lien « Configurer les plages » sous la frise',
    'editor.show_slots_on_card_hint':
      'Si désactivé, seul le lien est masqué ; la frise 24 h reste visible. Utilisez l’option ci-dessous pour autoriser l’ouverture de l’éditeur au clic sur le planning.',
    'editor.card_click_opens_editor_label': 'Clic sur le planning ouvre l’éditeur',
    'editor.card_click_opens_editor_hint':
      'Uniquement si le lien ci-dessus est désactivé. Si celui-ci est aussi désactivé, réactivez l’un des deux interrupteurs ci-dessus pour pouvoir modifier depuis le tableau de bord.',
    'editor.entity_missing_no_picker':
      'Capteur `{id}` introuvable. Chargez l’intégration Schedule Manager ou définissez `status_entity` dans le YAML.',
    'editor.schedules_on_card_title': 'Plannings à afficher sur la carte',
    'editor.schedules_on_card_hint':
      'Toutes les cases cochées = afficher tous les plannings. Décochez pour masquer un planning (au moins un reste visible).',
    'editor.schedules_order_hint':
      'Utilisez ↑ ↓ pour définir l’ordre d’affichage sur la carte du tableau de bord.',
    'editor.move_schedule_up_aria': 'Monter {name}',
    'editor.move_schedule_down_aria': 'Descendre {name}',
    'editor.no_schedules_hint':
      'Aucun planning dans les attributs du capteur pour l’instant. Créez un planning depuis la carte ou le service {service}.',
    'card.save_failed_prefix': 'Enregistrement impossible :',
    'card.actions_during_slot': 'Actions pendant cette plage',
    'card.remove_slot': 'Supprimer la plage',
    'card.add_slot': '+ Ajouter une plage',
    'card.cancel': 'Annuler',
    'card.save': 'Enregistrer',
    'card.end_time_label': 'Heure de fin (HH:MM)',
    'card.edit_action': 'Modifier l’action',
    'card.add_another_action': '+ Ajouter une autre action',
    'card.preset_current_suffix': ' (actuel)',
    'card.color_browser_picker_short': 'Nuancier du navigateur',
    'card.color_apply_aria': 'Appliquer la couleur {hex}',
    'card.time_axis_label': 'Heure',
    'card.close_overlay_aria': 'Fermer',
    'card.remove_entity_aria': 'Retirer {name}',
    'card.resize_aria_junction': 'Ajuster la transition entre deux plages',
    'card.resize_title_junction': 'Glisser pour déplacer la transition',
    'card.resize_aria_start': 'Déplacer le début de la plage',
    'card.resize_title_start': 'Glisser pour modifier l’heure de début',
    'card.resize_aria_end': 'Déplacer la fin de la plage',
    'card.resize_title_end': 'Glisser pour modifier l’heure de fin',
  },
};

export function msg(
  hass: HomeAssistant | undefined,
  key: string,
  vars?: Record<string, string | number>
): string {
  const lang = normalizeLang(hass?.locale?.language);
  let s = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

export function weekdayShort(hass: HomeAssistant | undefined, index: number): string {
  const lang = normalizeLang(hass?.locale?.language);
  const arr = lang === 'fr' ? WEEKDAY_FR : WEEKDAY_EN;
  return arr[index % 7] ?? '';
}
