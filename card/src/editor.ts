import { LitElement, html, css } from 'lit';
import { PropertyValues } from 'lit';
import { ref, createRef } from 'lit/directives/ref.js';
import { customElement, property, state } from 'lit/decorators.js';
import type { CardConfig, HomeAssistant } from './types';
import {
  DEFAULT_CARD_HEADER_TITLE,
  SCHEDULE_MANAGER_STATUS_ENTITY_ID,
} from './types';
import { collatorLocale, msg } from './i18n';
import { resolveOrderedScheduleIds } from './schedule-display-order';

/** Empreinte stable pour comparer la config affichée (alignée sur hasChanged de la carte). */
function editorConfigFingerprint(c?: CardConfig): string {
  if (!c) {
    return '';
  }
  return JSON.stringify({
    type: c.type,
    status_entity: c.status_entity,
    header_title: c.header_title,
    show_header: c.show_header,
    show_schedule_enable_toggle: c.show_schedule_enable_toggle,
    show_repeat_days_on_card: c.show_repeat_days_on_card,
    show_slots_on_card: c.show_slots_on_card,
    card_click_opens_editor: c.card_click_opens_editor,
    schedule_ids: c.schedule_ids ?? null,
    schedule_order: c.schedule_order ?? null,
  });
}

/** ha-switch / ha-checkbox (WebAwesome) : `target` peut être interne au shadow. */
function haFormControlCheckedFromChangeEvent(ev: Event): boolean {
  const host = ev.currentTarget as HTMLElement & { checked?: boolean };
  if (typeof host.checked === 'boolean') {
    return host.checked;
  }
  const inner = ev.target as HTMLElement & { checked?: boolean };
  return Boolean(inner.checked);
}

@customElement('schedule-manager-card-editor')
export class ScheduleManagerCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  /** HA met à jour cette référence au rechargement du dashboard ; sert à resynchroniser la config. */
  @property({ attribute: false }) public lovelace?: unknown;

  /** Contexte d’édition Lovelace (chemin de carte, etc.) ; mis à jour à l’ouverture du panneau. */
  @property({ attribute: false }) public context?: unknown;

  /**
   * Config poussée par Lovelace (certaines versions assignent la prop sans rappeler `setConfig`).
   * On ne l’écrit jamais depuis l’éditeur — évite les boucles avec le parent (cf. scheduler-card).
   */
  @property({ attribute: false }) public config?: CardConfig;

  /** État local de l’éditeur — mis à jour par `setConfig` / la prop `config`, et par `_patchConfig`. */
  @state() private _config?: CardConfig;

  /** Brouillon titre : évite que les re-renders / ha-textfield réinitialisent la frappe. */
  @state() private _headerTitleDraft = '';

  private _headerTitleRef = createRef<HTMLInputElement>();

  /** Empreinte des plannings sur le capteur — détecte un renommage sans changement de ref. `hass`. */
  private _schedulesSnap = '';

  /** Dernière config émise via `config-changed` — évite qu’un echo Lovelace stale écrase l’état local. */
  private _pendingConfigFingerprint = '';

  static styles = css`
    .card-config {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
    }
    .field-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hint {
      margin: 0;
      font-size: 0.82rem;
      line-height: 1.45;
      color: var(--secondary-text-color, rgba(0, 0, 0, 0.54));
    }
    code.inline {
      font-size: 0.85em;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(127, 127, 127, 0.2);
      word-break: break-all;
    }
    .schedule-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--divider-color);
      background: rgba(var(--rgb-primary-text-color, 221, 221, 221), 0.04);
    }
    .schedule-list-title {
      font-size: 0.88rem;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--primary-text-color);
    }
    ha-formfield {
      --mdc-theme-text-primary-on-background: var(--primary-text-color);
    }
    .schedule-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 0;
    }
    .schedule-row ha-checkbox {
      flex: 1;
      min-width: 0;
      display: flex;
      min-height: 40px;
    }
    .schedule-row-order {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: 2px;
    }
    .schedule-row-order button {
      margin: 0;
      padding: 2px 8px;
      font-size: 0.75rem;
      line-height: 1.1;
      border-radius: 4px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color, var(--ha-card-background, #fff));
      color: var(--primary-text-color);
      cursor: pointer;
    }
    .schedule-row-order button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    ha-textfield {
      display: block;
      width: 100%;
    }
    .sm-config-title-input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 16px;
      font-size: 1rem;
      font-family: inherit;
      border-radius: 4px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color, var(--ha-card-background, #fff));
      color: var(--primary-text-color);
    }
    .sm-config-title-input:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 1px var(--primary-color);
    }
    .sm-sub-label {
      display: block;
      margin-top: 12px;
      margin-bottom: 4px;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--primary-text-color);
    }
  `;

  /** Comme scheduler-card : `setConfig` remplace l’état local (pas de fusion avec l’ancien, pas d’écriture sur `this.config`). */
  setConfig(config: CardConfig) {
    if (!config || typeof config !== 'object') {
      return;
    }
    const flat = this._configWithoutUndefinedKeys(
      config as unknown as Record<string, unknown>
    );
    this._applyIncomingConfigRecord({
      ...flat,
      type: 'custom:schedule-manager-card',
    } as CardConfig);
    this.requestUpdate();
  }

  /**
   * Fusion superficielle : les clés absentes de `incoming` ne retirent pas les valeurs déjà dans `prev`
   * (setConfig / host.value souvent partiels côté Lovelace).
   */
  private _mergeLovelaceShallow(prev: CardConfig | undefined, incoming: CardConfig): CardConfig {
    const p = { ...((prev ?? {}) as unknown as object) } as Record<string, unknown>;
    const inc = this._configWithoutUndefinedKeys(incoming as unknown as Record<string, unknown>);
    return { ...p, ...inc, type: 'custom:schedule-manager-card' } as unknown as CardConfig;
  }

  /**
   * Config explicite : booléens toujours présents + capteur par défaut si absent du YAML,
   * pour que l’éditeur et le YAML reflètent le même état (évite les configs « invisibles »).
   */
  private _canonicalEditorConfig(r: Record<string, unknown>): CardConfig {
    const showHeader = r.show_header !== false;
    const showToggle = r.show_schedule_enable_toggle !== false;
    const showRepeat = r.show_repeat_days_on_card !== false;
    const showSlotsOnCard = r.show_slots_on_card !== false;
    const seRaw = r.status_entity;
    const seTrim =
      typeof seRaw === 'string' && seRaw.trim() ? seRaw.trim() : '';
    const out: CardConfig = {
      type: 'custom:schedule-manager-card',
      show_header: showHeader,
      show_schedule_enable_toggle: showToggle,
      show_repeat_days_on_card: showRepeat,
      show_slots_on_card: showSlotsOnCard,
    };
    if (!showSlotsOnCard) {
      out.card_click_opens_editor = r.card_click_opens_editor !== false;
    }
    if (seTrim) {
      out.status_entity = seTrim;
    } else {
      out.status_entity = SCHEDULE_MANAGER_STATUS_ENTITY_ID;
    }
    const ht = typeof r.header_title === 'string' ? r.header_title.trim() : '';
    if (ht) {
      out.header_title = ht;
    }
    const sid = r.schedule_ids;
    if (Array.isArray(sid)) {
      const ids = sid.map((x) => String(x).trim()).filter(Boolean);
      if (ids.length > 0) {
        out.schedule_ids = ids;
      }
    }
    const ord = r.schedule_order;
    if (Array.isArray(ord)) {
      const ids = ord.map((x) => String(x).trim()).filter(Boolean);
      if (ids.length > 0) {
        out.schedule_order = ids;
      }
    }
    return out;
  }

  /** Normalise une config HA → état local `_config`. */
  private _applyIncomingConfigRecord(config: CardConfig) {
    const base = this._configWithoutUndefinedKeys(
      config as unknown as Record<string, unknown>
    );
    this._config = this._canonicalEditorConfig({
      ...base,
      type: 'custom:schedule-manager-card',
    });
    const te = this._headerTitleRef.value;
    if (document.activeElement !== te) {
      this._headerTitleDraft = this._config.header_title ?? '';
    }
  }

  /** Retire les clés `undefined` : le spread les copierait et effacerait `schedule_ids` / `header_title`. */
  private _configWithoutUndefinedKeys(
    c: CardConfig | Record<string, unknown> | undefined
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!c || typeof c !== 'object') {
      return out;
    }
    for (const [k, v] of Object.entries(c)) {
      if (v !== undefined) {
        out[k] = v;
      }
    }
    return out;
  }

  updated(changed: PropertyValues) {
    super.updated(changed);
    /* Prop `config` seule (sans `setConfig`) : fusion superficielle puis application. */
    if (changed.has('config') && this.config && typeof this.config === 'object') {
      const prev = changed.get('config') as CardConfig | undefined;
      if (this.config !== prev) {
        const merged = this._mergeLovelaceShallow(this._config, this.config);
        // Ne pas écraser filtre / ordre locaux si Lovelace renvoie une config partielle sans ces clés.
        const local = this._config as unknown as Record<string, unknown> | undefined;
        const mergedRec = merged as unknown as Record<string, unknown>;
        if (local?.schedule_ids !== undefined && mergedRec.schedule_ids === undefined) {
          mergedRec.schedule_ids = local.schedule_ids;
        }
        if (local?.schedule_order !== undefined && mergedRec.schedule_order === undefined) {
          mergedRec.schedule_order = local.schedule_order;
        }
        const mergedFp = editorConfigFingerprint(merged);
        const localFp = editorConfigFingerprint(this._config);
        if (
          this._pendingConfigFingerprint &&
          localFp === this._pendingConfigFingerprint &&
          mergedFp !== this._pendingConfigFingerprint
        ) {
          return;
        }
        if (mergedFp === this._pendingConfigFingerprint) {
          this._pendingConfigFingerprint = '';
        }
        if (mergedFp !== localFp) {
          this._applyIncomingConfigRecord(merged);
        }
      }
    }
    if (this.hass) {
      const snap = JSON.stringify(this._schedulesRecord());
      const schedulesChanged = snap !== this._schedulesSnap;
      if (schedulesChanged) {
        this._schedulesSnap = snap;
      }
      if (changed.has('hass') || schedulesChanged) {
        this.requestUpdate();
      }
    }
    if (changed.has('hass') || changed.has('config') || changed.has('_config')) {
      this._maybeApplyDefaultStatusEntity();
    }
  }

  /**
   * Préremplit le capteur par défaut en mémoire locale uniquement — pas de `config-changed`
   * à l’ouverture (sinon Lovelace écrase la config avant affichage, cf. scheduler-card).
   */
  private _maybeApplyDefaultStatusEntity() {
    if (!this.hass) {
      return;
    }
    if (!this.hass.states[SCHEDULE_MANAGER_STATUS_ENTITY_ID]) {
      return;
    }
    if (!this._config) {
      return;
    }
    if (this._config.status_entity?.trim()) {
      return;
    }
    this._config = this._canonicalEditorConfig({
      ...(this._config as unknown as Record<string, unknown>),
      type: 'custom:schedule-manager-card',
    });
    this.requestUpdate();
  }

  private _resolvedStatusEntityId(): string {
    return this._config?.status_entity?.trim() || SCHEDULE_MANAGER_STATUS_ENTITY_ID;
  }

  private _schedulesRecord(): Record<string, { name?: string }> {
    const st = this.hass?.states[this._resolvedStatusEntityId()];
    const raw = st?.attributes?.schedules as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    return raw as Record<string, { name?: string }>;
  }

  private _scheduleEntries(): { id: string; name: string }[] {
    const rec = this._schedulesRecord();
    return Object.entries(rec)
      .map(([id, sch]) => ({
        id,
        name: typeof sch?.name === 'string' && sch.name.trim() ? sch.name.trim() : id,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, collatorLocale(this.hass), { sensitivity: 'base' })
      );
  }

  /** Tous les plannings du capteur, triés selon `schedule_order` (liste éditeur). */
  private _orderedAllEntries(): { id: string; name: string }[] {
    const rec = this._schedulesRecord();
    const availableIds = Object.keys(rec);
    const collator = collatorLocale(this.hass);
    const ids = resolveOrderedScheduleIds(
      this._config ?? { type: 'custom:schedule-manager-card' },
      availableIds,
      (a, b) => {
        const na =
          typeof rec[a]?.name === 'string' && rec[a].name!.trim() ? rec[a].name!.trim() : a;
        const nb =
          typeof rec[b]?.name === 'string' && rec[b].name!.trim() ? rec[b].name!.trim() : b;
        return na.localeCompare(nb, collator, { sensitivity: 'base' });
      },
      { applyVisibilityFilter: false }
    );
    return ids.map((id) => ({
      id,
      name:
        typeof rec[id]?.name === 'string' && rec[id].name!.trim() ? rec[id].name!.trim() : id,
    }));
  }

  private _allScheduleIds(): string[] {
    return this._scheduleEntries().map((e) => e.id);
  }

  private _normScheduleId(id: string): string {
    return String(id).trim().toLowerCase();
  }

  /** Liste explicite de plannings affichés (défini = filtre actif). */
  private _explicitScheduleIds(): string[] | undefined {
    const raw = this._config?.schedule_ids as unknown;
    if (raw == null) {
      return undefined;
    }
    if (Array.isArray(raw)) {
      const ids = raw.map((x) => String(x).trim()).filter(Boolean);
      return ids.length ? ids : undefined;
    }
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) {
        return undefined;
      }
      return s
        .split(/[\s,]+/)
        .map((x: string) => x.trim())
        .filter(Boolean);
    }
    return undefined;
  }

  /** Filtrage actif uniquement si `schedule_ids` est une liste non vide. */
  private _isScheduleChecked(scheduleId: string): boolean {
    const explicit = this._explicitScheduleIds();
    if (!explicit || explicit.length === 0) {
      return true;
    }
    const needle = this._normScheduleId(scheduleId);
    return explicit.some((id) => this._normScheduleId(String(id)) === needle);
  }

  private _onScheduleCheck(ev: Event) {
    const checkbox = ev.target as HTMLElement & { checked?: boolean; value?: string | null };
    const scheduleId = String(checkbox.value ?? '').trim();
    if (!scheduleId) {
      return;
    }
    const checked = typeof checkbox.checked === 'boolean' ? checkbox.checked : false;
    const allIds = this._allScheduleIds();
    if (allIds.length === 0) {
      return;
    }

    const explicit = this._explicitScheduleIds();
    const selected = new Set<string>(
      explicit && explicit.length > 0 ? explicit : allIds
    );

    if (checked) {
      selected.add(scheduleId);
    } else {
      if (selected.size <= 1) {
        checkbox.checked = true;
        return;
      }
      selected.delete(scheduleId);
    }

    const allOn =
      selected.size === allIds.length && allIds.every((id) => selected.has(id));
    const arr = this._orderedAllEntries()
      .map((e) => e.id)
      .filter((id) => selected.has(id));
    this._patchConfig({
      schedule_ids: allOn ? undefined : arr,
    });
  }

  private _moveScheduleOrder(scheduleId: string, delta: number, ev?: Event) {
    ev?.stopPropagation();
    ev?.preventDefault();
    const entries = this._orderedAllEntries();
    const idx = entries.findIndex((e) => e.id === scheduleId);
    if (idx < 0) {
      return;
    }
    const target = idx + delta;
    if (target < 0 || target >= entries.length) {
      return;
    }
    const ids = entries.map((e) => e.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    this._patchConfig({ schedule_order: ids });
  }

  render() {
    const hass = this.hass as HomeAssistant | undefined;
    if (!hass) {
      return html`<div class="card-config">${msg(undefined, 'editor.loading')}</div>`;
    }

    const entries = this._orderedAllEntries();
    const entityMissing = !hass.states[this._resolvedStatusEntityId()];

    return html`
      <div class="card-config">
        <div class="field-block">
          <div class="schedule-list-title">${msg(hass, 'editor.card_title_section')}</div>
          <ha-formfield label=${msg(hass, 'editor.show_title_switch')}>
            <ha-switch
              .checked=${this._config?.show_header !== false}
              @change=${this._onShowHeaderChange}
            ></ha-switch>
          </ha-formfield>
          ${this._config?.show_header !== false
            ? html`
                <label class="sm-sub-label" for="sm-editor-card-title"
                  >${msg(hass, 'editor.custom_title_optional')}</label
                >
                <input
                  id="sm-editor-card-title"
                  class="sm-config-title-input"
                  type="text"
                  name="schedule_manager_card_title"
                  autocomplete="off"
                  placeholder=${DEFAULT_CARD_HEADER_TITLE}
                  .value=${this._headerTitleDraft}
                  ${ref(this._headerTitleRef)}
                  @input=${this._onHeaderTitleInput}
                  @blur=${this._onHeaderTitleBlur}
                />
                <p class="hint">
                  ${msg(hass, 'editor.title_apply_hint')}
                  <code class="inline">${DEFAULT_CARD_HEADER_TITLE}</code>.
                </p>
              `
            : html`
                <p class="hint">
                  ${msg(hass, 'editor.title_disabled_hint')}
                </p>
              `}
        </div>
        <div class="field-block">
          <ha-formfield label=${msg(hass, 'editor.schedule_toggle_label')}>
            <ha-switch
              .checked=${this._config?.show_schedule_enable_toggle !== false}
              @change=${this._onShowScheduleEnableToggleChange}
            ></ha-switch>
          </ha-formfield>
          <p class="hint">
            ${msg(hass, 'editor.schedule_toggle_hint')}
          </p>
        </div>
        <div class="field-block">
          <ha-formfield label=${msg(hass, 'editor.show_repeat_days_on_card_label')}>
            <ha-switch
              .checked=${this._config?.show_repeat_days_on_card !== false}
              @change=${this._onShowRepeatDaysOnCardChange}
            ></ha-switch>
          </ha-formfield>
          <p class="hint">
            ${msg(hass, 'editor.show_repeat_days_on_card_hint')}
          </p>
        </div>
        <div class="field-block">
          <ha-formfield label=${msg(hass, 'editor.show_slots_on_card_label')}>
            <ha-switch
              .checked=${this._config?.show_slots_on_card !== false}
              @change=${this._onShowSlotsOnCardChange}
            ></ha-switch>
          </ha-formfield>
          <p class="hint">
            ${msg(hass, 'editor.show_slots_on_card_hint')}
          </p>
          ${this._config?.show_slots_on_card === false
            ? html`
                <ha-formfield label=${msg(hass, 'editor.card_click_opens_editor_label')}>
                  <ha-switch
                    .checked=${this._config?.card_click_opens_editor !== false}
                    @change=${this._onCardClickOpensEditorChange}
                  ></ha-switch>
                </ha-formfield>
                <p class="hint">
                  ${msg(hass, 'editor.card_click_opens_editor_hint')}
                </p>
              `
            : html``}
        </div>
        ${entityMissing
          ? html`
              <div class="field-block">
                <p class="hint">
                  ${msg(hass, 'editor.entity_missing_no_picker', {
                    id: this._resolvedStatusEntityId(),
                  })}
                </p>
              </div>
            `
          : html``}
        ${!entityMissing
          ? html`
              <div class="field-block">
                ${entries.length === 0
                  ? html`
                      <p class="hint">
                        ${msg(hass, 'editor.no_schedules_hint', {
                          service: 'schedule_manager.create_schedule',
                        })}
                      </p>
                    `
                  : html`
                      <div class="schedule-list-title">${msg(hass, 'editor.schedules_on_card_title')}</div>
                      <p class="hint">
                        ${msg(hass, 'editor.schedules_on_card_hint')}
                      </p>
                      <p class="hint">
                        ${msg(hass, 'editor.schedules_order_hint')}
                      </p>
                      <div class="schedule-list">
                        ${entries.map(
                          (row, index) => html`
                            <div class="schedule-row">
                              <ha-checkbox
                                .checked=${this._isScheduleChecked(row.id)}
                                .value=${row.id}
                                @change=${this._onScheduleCheck}
                              >
                                ${row.name}
                              </ha-checkbox>
                              <div class="schedule-row-order">
                                <button
                                  type="button"
                                  ?disabled=${index === 0}
                                  aria-label=${msg(hass, 'editor.move_schedule_up_aria', {
                                    name: row.name,
                                  })}
                                  title=${msg(hass, 'editor.move_schedule_up_aria', {
                                    name: row.name,
                                  })}
                                  @click=${(e: Event) => this._moveScheduleOrder(row.id, -1, e)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  ?disabled=${index >= entries.length - 1}
                                  aria-label=${msg(hass, 'editor.move_schedule_down_aria', {
                                    name: row.name,
                                  })}
                                  title=${msg(hass, 'editor.move_schedule_down_aria', {
                                    name: row.name,
                                  })}
                                  @click=${(e: Event) => this._moveScheduleOrder(row.id, 1, e)}
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          `
                        )}
                      </div>
                    `}
              </div>
            `
          : html``}
      </div>
    `;
  }

  private _patchConfig(patch: Partial<CardConfig>) {
    const merged: Record<string, unknown> = {
      type: 'custom:schedule-manager-card',
      ...(this._config as Record<string, unknown> | undefined),
      ...patch,
    };
    for (const [key, val] of Object.entries(patch)) {
      if (val === undefined) {
        delete merged[key];
      }
    }
    for (const k of Object.keys(merged)) {
      if (merged[k] === undefined) {
        delete merged[k];
      }
    }
    /** Objet canonique : clés explicites pour le YAML Lovelace. */
    const outgoing = this._canonicalEditorConfig(merged);
    this._config = outgoing;
    this._pendingConfigFingerprint = editorConfigFingerprint(outgoing);
    const te = this._headerTitleRef.value;
    if (document.activeElement !== te) {
      this._headerTitleDraft = this._config.header_title ?? '';
    }
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        bubbles: true,
        composed: true,
        detail: { config: outgoing },
      })
    );
  }

  private _onShowHeaderChange(ev: Event) {
    const checked = haFormControlCheckedFromChangeEvent(ev);
    this._patchConfig({ show_header: checked });
  }

  private _onShowScheduleEnableToggleChange(ev: Event) {
    const checked = haFormControlCheckedFromChangeEvent(ev);
    this._patchConfig({
      show_schedule_enable_toggle: checked,
    });
  }

  private _onShowRepeatDaysOnCardChange(ev: Event) {
    const checked = haFormControlCheckedFromChangeEvent(ev);
    this._patchConfig({
      show_repeat_days_on_card: checked,
    });
  }

  private _onShowSlotsOnCardChange(ev: Event) {
    const checked = haFormControlCheckedFromChangeEvent(ev);
    this._patchConfig({
      show_slots_on_card: checked,
    });
  }

  private _onCardClickOpensEditorChange(ev: Event) {
    const checked = haFormControlCheckedFromChangeEvent(ev);
    this._patchConfig({
      card_click_opens_editor: checked,
    });
  }

  private _onHeaderTitleInput(ev: Event) {
    const t = ev.target as HTMLInputElement;
    this._headerTitleDraft = t.value;
  }

  private _onHeaderTitleBlur() {
    const v = this._headerTitleDraft.trim();
    this._patchConfig({ header_title: v ? v : undefined });
  }

}
