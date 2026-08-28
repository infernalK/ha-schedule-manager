import { LitElement, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { customElement, property, state } from 'lit/decorators.js';
import { PropertyValues } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import {
  BlockAction,
  CardConfig,
  HomeAssistant,
  Schedule,
  TimeBlock,
  TimeBlockServicePayload,
  SCHEDULE_MANAGER_STATUS_ENTITY_ID,
} from './types';
import {
  newEmptyAction,
  normalizeScheduleTimeBlocks,
  normalizeTimeBlock,
} from './block-model';
import { ScheduleManagerServices } from './services';
import { styles } from './styles';
import {
  applyDefaultFieldsForService,
  parseDomainService,
  servicesForDomain,
  stripPayloadForNewService,
} from './action-service-helpers';
import {
  domainIcon,
  entityIcon,
  friendlyEntityName,
  listEntitiesInDomain,
  listEntityIdsForAction,
  listSelectableDomains,
  serviceSecondaryHint,
} from './action-wizard-i18n';
import { domainLabel, msg, servicePrimaryLabel, weekdayShort, collatorLocale } from './i18n';
import { resolveOrderedScheduleIds } from './schedule-display-order';
import { climatePresetModesList, entityCompatibleWithAction } from './entity-domains';
import {
  blockTimelineFill,
  blocksToTimelineSegments,
  DEFAULT_TIMELINE_SCALE_TICKS,
  hasOverlappingSameDayBlocks,
  isOvernightBlock,
  HA_END_OF_DAY_TIME,
  MINUTES_PER_DAY,
  minuteToHaTimeForSchedule,
  nowActiveRingCssVars,
  nowPercentOfDay,
  paintOrderSegmentIndexForNowPct,
  sameDayBlockIntervalExclusiveEnd,
  SCHEDULE_MANAGER_COLOR_KEY,
  snapMinutesToGrid,
  suggestGapIntervalMinutes,
  TIMELINE_DRAG_SNAP_MINUTES,
  timelineResizeHandlesForSelection,
  timelineScaleTicksForWidth,
  timeStringToMinutes,
  tryInsertSlotAtDayStart,
  applyDragMoveWithOptionalSwap,
  type TimelineResizeHandle,
  type TimelineSegment,
} from './timeline-helpers';

import './editor';

/** Pastilles de couleur rapides (+ valeur du sélecteur). */
const BLOCK_COLOR_PRESETS = [
  '#2196F3',
  '#4CAF50',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
  '#E91E63',
  '#795548',
  '#607D8B',
] as const;

/** État du toggle après interaction (ha-switch WebAwesome : `target` peut être interne au shadow). */
function haSwitchCheckedFromChangeEvent(ev: Event): boolean {
  const host = ev.currentTarget as HTMLElement & { checked?: boolean };
  if (typeof host.checked === 'boolean') {
    return host.checked;
  }
  const inner = ev.target as HTMLElement & { checked?: boolean };
  return Boolean(inner.checked);
}

function payloadWithoutEntityId(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const rec = { ...(payload as Record<string, unknown>) };
  delete rec.entity_id;
  return rec;
}

/** Empêcher qu’une même couleur fasse doublon avec une autre plage identique en action. */
function payloadForDuplicateCheck(payload: unknown): Record<string, unknown> {
  const rec = payloadWithoutEntityId(payload);
  delete rec[SCHEDULE_MANAGER_COLOR_KEY];
  return rec;
}

function entityIdsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const e = (payload as Record<string, unknown>).entity_id;
  if (typeof e === 'string') {
    const t = e.trim();
    return t && t.includes('.') ? [t] : [];
  }
  if (Array.isArray(e)) {
    const raw = e
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x.includes('.'));
    return [...new Set(raw)];
  }
  return [];
}

/** Ouverture éditeur ou planning vide : une plage couvrant la journée, action à définir par l’assistant. */
function defaultFullDayBlock(): TimeBlock {
  return {
    start_time: '00:00:00',
    end_time: HA_END_OF_DAY_TIME,
    actions: [newEmptyAction()],
  };
}

function findDuplicateBlockIndex(blocks: TimeBlock[]): number {
  const seen = new Set<string>();
  for (let i = 0; i < blocks.length; i++) {
    const fp = blockFingerprint(blocks[i]);
    if (seen.has(fp)) {
      return i;
    }
    seen.add(fp);
  }
  return -1;
}

interface VisualEditState {
  scheduleId: string;
  blocks: TimeBlock[];
  repeatDays: number[];
  selectedIndex: number;
  /** Action en cours d’édition dans la plage sélectionnée. */
  selectedActionIndex: number;
}

/** Format HH:MM[:SS] pour les services HA (évite `<input type="time">` = crash app Mac Catalyst). */
function normalizeTimeForHa(t: string): string {
  const s = t.trim();
  if (!s) {
    return '00:00:00';
  }
  const p = s.split(':').map((x) => x.trim());
  if (p.length < 2) {
    return '00:00:00';
  }
  const hRaw = parseInt(p[0] ?? '0', 10);
  const mRaw = parseInt(p[1] ?? '0', 10);
  if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) {
    return '00:00:00';
  }
  const secRaw =
    p[2] !== undefined && p[2] !== ''
      ? parseInt(p[2] ?? '0', 10)
      : 0;
  const sec =
    p[2] !== undefined && p[2] !== ''
      ? Number.isNaN(secRaw)
        ? 0
        : Math.min(59, Math.max(0, secRaw))
      : 0;

  /** `cv.time` n’accepte pas 24:00:00 — tout instant ≥ fin de journée → dernière seconde HA. */
  const totalMinutes = hRaw * 60 + mRaw + sec / 60;
  if (totalMinutes >= MINUTES_PER_DAY) {
    return HA_END_OF_DAY_TIME;
  }

  const h = Math.min(23, Math.max(0, hRaw));
  const m = Math.min(59, Math.max(0, mRaw));
  if ([h, m, sec].some((n) => Number.isNaN(n))) {
    return '00:00:00';
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function haTimeToHHMM(t: string): string {
  return normalizeTimeForHa(t).slice(0, 5);
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = sortKeysDeep(rec[k]);
  }
  return out;
}

function stablePayloadString(payload: unknown): string {
  return JSON.stringify(sortKeysDeep(payload ?? {}));
}

/** Empêche deux entrées identiques (horaires + toutes les actions + payloads normalisés). */
function blockFingerprint(block: TimeBlock): string {
  const st = normalizeTimeForHa(block.start_time);
  const et = normalizeTimeForHa(block.end_time);
  const parts = [...(block.actions || [])]
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (a) =>
        `${String(a.action_type).trim()}|${stablePayloadString(
          payloadForDuplicateCheck(a.action_payload)
        )}`
    );
  return `${st}|${et}|${parts.join('||')}`;
}

/** Lit : compare le contenu effectif — si HA réutilise la même référence d’objet, l’aperçu se met quand même à jour. */
function scheduleManagerCardConfigChanged(
  next: CardConfig | undefined,
  prev: CardConfig | undefined
): boolean {
  const snap = (c: CardConfig | undefined) =>
    c
      ? JSON.stringify({
          status_entity: c.status_entity,
          header_title: c.header_title,
          show_header: c.show_header,
          show_schedule_enable_toggle: c.show_schedule_enable_toggle,
          show_repeat_days_on_card: c.show_repeat_days_on_card,
          show_slots_on_card: c.show_slots_on_card,
          card_click_opens_editor: c.card_click_opens_editor,
          schedule_ids: c.schedule_ids ?? null,
          schedule_order: c.schedule_order ?? null,
        })
      : '';
  return snap(next) !== snap(prev);
}

@customElement('schedule-manager-card')
export class ScheduleManagerCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({
    attribute: false,
    hasChanged: scheduleManagerCardConfigChanged,
  })
  public config!: CardConfig;

  @state() private _newScheduleName = '';
  @state() private _creating = false;
  /** Éditeur plein écran (frise + détail plage), style config HA */
  @state() private _visualEdit: VisualEditState | null = null;
  /** Assistant « Choisir une action » : domaine → service → entité compatible. */
  @state() private _actionWizardOpen = false;
  @state() private _actionWizardStep:
    | 'domain'
    | 'service'
    | 'entity'
    | 'climate_preset' = 'domain';
  @state() private _actionWizardSearch = '';
  @state() private _actionWizardDomain: string | null = null;
  /** Nom court du service sélectionné (ex. turn_on) avant le choix de l’entité. */
  @state() private _actionWizardServiceShort: string | null = null;
  @state() private _actionWizardEntityId: string | null = null;
  /** `${blockIdx}-${actionIdx}` quand le panneau d’ajout d’entité (bouton +) est ouvert. */
  @state() private _entityAddPickerOpenKey: string | null = null;
  /** Panneau « remplacer cette entité » après clic sur une puce. */
  @state() private _entityPickerReplace: {
    blockIdx: number;
    actionIdx: number;
    oldEntityId: string;
  } | null = null;
  /** Filtre texte pour la liste manuelle d’entités (remplace ha-entity-picker dans le modal). */
  @state() private _entityManualListSearch = '';
  /** Empreinte des plannings lus sur le capteur — détecte un renommage même si `hass` garde la même référence. */
  private _schedulesSnap = '';
  /** Réglé à l’ouverture de l’assistant : action à mettre à jour (évite décalage avec selectedActionIndex). */
  private _actionWizardTargetActionIndex = 0;
  /** Largeur du bandeau éditeur pour graduations adaptatives (pattern scheduler-card). */
  @state() private _editorFriseWidth = 0;

  private _editorFriseResizeObserver?: ResizeObserver;

  /** Déplacement horizontal de la plage sélectionnée (durée conservée). */
  private _segmentDrag:
    | null
    | {
        pointerId: number;
        blockIdx: number;
        rail: HTMLElement;
        slotEl: HTMLElement;
        startClientX: number;
        origStartM: number;
        origEndM: number;
      } = null;

  private _suppressSlotClick = false;

  /** Glisser-déposer sur la frise (pas @state : évite un render à chaque pixel). */
  private _boundaryDrag:
    | null
    | ({
        pointerId: number;
        minM: number;
        maxM: number;
        rail: HTMLElement;
        handle: HTMLElement;
      } & (
        | { mode: 'junction'; leftIdx: number; rightIdx: number }
        | { mode: 'start'; blockIdx: number }
        | { mode: 'end'; blockIdx: number }
      )) = null;

  private _onBoundaryMove = (ev: PointerEvent) => {
    const d = this._boundaryDrag;
    if (!d || !this._visualEdit || ev.pointerId !== d.pointerId) {
      return;
    }
    const rect = d.rail.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
    const pct = (x / rect.width) * 100;
    let m = Math.round((pct / 100) * MINUTES_PER_DAY);
    m = snapMinutesToGrid(m, TIMELINE_DRAG_SNAP_MINUTES);
    m = Math.max(d.minM, Math.min(d.maxM, m));
    const ha = minuteToHaTimeForSchedule(m);
    const blocks = [...this._visualEdit.blocks];

    if (d.mode === 'junction') {
      const L = blocks[d.leftIdx];
      const R = blocks[d.rightIdx];
      if (!L || !R) {
        return;
      }
      blocks[d.leftIdx] = { ...L, end_time: ha };
      blocks[d.rightIdx] = { ...R, start_time: ha };
    } else if (d.mode === 'start') {
      const B = blocks[d.blockIdx];
      if (!B) {
        return;
      }
      blocks[d.blockIdx] = { ...B, start_time: ha };
    } else {
      const B = blocks[d.blockIdx];
      if (!B) {
        return;
      }
      blocks[d.blockIdx] = { ...B, end_time: ha };
    }

    if (hasOverlappingSameDayBlocks(blocks)) {
      return;
    }
    this._visualEdit = { ...this._visualEdit, blocks };
    this.requestUpdate();
  };

  private _onBoundaryUp = (ev: PointerEvent) => {
    const d = this._boundaryDrag;
    if (!d) {
      return;
    }
    window.removeEventListener('pointermove', this._onBoundaryMove);
    window.removeEventListener('pointerup', this._onBoundaryUp);
    window.removeEventListener('pointercancel', this._onBoundaryUp);
    if (ev.pointerId === d.pointerId) {
      try {
        d.handle.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    this._boundaryDrag = null;
  };

  static get styles() {
    return styles;
  }

  static getConfigElement() {
    return document.createElement('schedule-manager-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:schedule-manager-card',
      status_entity: SCHEDULE_MANAGER_STATUS_ENTITY_ID,
      show_header: true,
      show_schedule_enable_toggle: true,
      show_repeat_days_on_card: true,
    };
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (this.hass) {
      const snap = JSON.stringify(this.getSchedulesRecord());
      const schedulesChanged = snap !== this._schedulesSnap;
      if (schedulesChanged) {
        this._schedulesSnap = snap;
      }
      if (changed.has('hass') || schedulesChanged) {
        void this.requestUpdate();
      }
    }
    if (changed.has('_visualEdit')) {
      if (this._visualEdit) {
        this._syncEditorFriseObserver();
        requestAnimationFrame(() => {
          const m = this.shadowRoot?.querySelector('.sm-modal') as HTMLElement | undefined;
          m?.focus();
        });
      } else {
        this._detachEditorFriseObserver();
        this._editorFriseWidth = 0;
      }
    }
  }

  private statusEntityId(): string {
    return this.config?.status_entity?.trim() || SCHEDULE_MANAGER_STATUS_ENTITY_ID;
  }

  private _showCardHeader(): boolean {
    return this.config?.show_header !== false;
  }

  private _cardHeaderTitleText(): string {
    const raw = this.config?.header_title?.trim();
    if (raw) {
      return raw;
    }
    return msg(this.hass, 'card.default_header_title');
  }

  private _renderCardHeader() {
    if (!this._showCardHeader()) {
      return html``;
    }
    return html`<div class="card-header">${this._cardHeaderTitleText()}</div>`;
  }

  private _showScheduleEnableToggle(): boolean {
    return this.config?.show_schedule_enable_toggle !== false;
  }

  /**
   * La clé de l’objet `attributes.schedules` est l’identifiant canonique côté stockage.
   * Si le champ `id` à l’intérieur diverge (fichier JSON édité, ancien bug), les actions / suppression
   * visaient le mauvais UUID — d’où un planning « fantôme » ou introuvable.
   */
  private withCanonicalId(storageKey: string, schedule: Schedule): Schedule {
    const base =
      schedule.id === storageKey ? schedule : { ...schedule, id: storageKey };
    return normalizeScheduleTimeBlocks(base);
  }

  private getSchedulesRecord(): Record<string, Schedule> {
    const state = this.hass?.states[this.statusEntityId()];
    const attrs = state?.attributes as Record<string, unknown> | undefined;
    const raw = attrs?.schedules;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    return raw as Record<string, Schedule>;
  }

  private services(): ScheduleManagerServices {
    return new ScheduleManagerServices(this.hass);
  }

  render() {
    if (!this.hass || !this.config) {
      return html`<ha-card><div class="card-content">${msg(undefined, 'card.loading')}</div></ha-card>`;
    }

    const scheduleIds = this.config.schedule_ids || [];
    const schedulesMap = this.getSchedulesRecord();
    const hass = this.hass;

    if (!hass.states[this.statusEntityId()]) {
      return html`
        <ha-card>
          ${this._renderCardHeader()}
          <div class="card-content">
            ${msg(hass, 'card.entity_missing')} <code>${this.statusEntityId()}</code>
          </div>
        </ha-card>
      `;
    }

    return html`
      <div>
        <ha-card class="card">
          ${this._renderCardHeader()}
          <div class="card-content">
            ${this.renderSchedulesList(scheduleIds, schedulesMap)}
          </div>
        </ha-card>
        ${this.renderVisualEditorOverlay()}
        ${this.renderActionWizardOverlay()}
      </div>
    `;
  }

  private renderSchedulesList(scheduleIds: string[], schedulesMap: Record<string, Schedule>) {
    const hass = this.hass;
    if (!hass) {
      return html``;
    }
    const totalCount = Object.keys(schedulesMap).length;
    const collator = collatorLocale(hass);
    const compareIds = (a: string, b: string) => {
      const na = schedulesMap[a]?.name?.trim() || a;
      const nb = schedulesMap[b]?.name?.trim() || b;
      return na.localeCompare(nb, collator, { sensitivity: 'base' });
    };
    const orderedIds = resolveOrderedScheduleIds(this.config, Object.keys(schedulesMap), compareIds);
    const list: Schedule[] = orderedIds
      .map((id) => {
        const sch = schedulesMap[id];
        return sch ? this.withCanonicalId(id, sch) : undefined;
      })
      .filter((s): s is Schedule => Boolean(s));

    if (!list.length) {
      if (scheduleIds.length > 0 && totalCount > 0) {
        return html`
          <div class="empty-hint">
            ${msg(hass, 'card.empty_filter_schedules')}
          </div>
        `;
      }
      if (totalCount === 0) {
        return html`
          <div class="empty-hint">
            ${msg(hass, 'card.empty_no_schedules')}
            <code class="inline">schedule_manager.create_schedule</code>
            ${msg(hass, 'card.empty_no_schedules_service')}
          </div>
          <div class="create-row">
            <input
              type="text"
              placeholder=${msg(hass, 'card.placeholder_schedule_name')}
              .value=${this._newScheduleName}
              @input=${(e: Event) => {
                this._newScheduleName = (e.target as HTMLInputElement).value;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  void this.createScheduleFromInput();
                }
              }}
            />
            <button
              type="button"
              ?disabled=${this._creating || !this._newScheduleName.trim()}
              @click=${() => this.createScheduleFromInput()}
            >
              ${this._creating ? msg(hass, 'card.creating') : msg(hass, 'card.create_schedule')}
            </button>
          </div>
        `;
      }
      return html`<div class="empty-hint">${msg(hass, 'card.empty_list')}</div>`;
    }

    return html`${list.map((s) => this.renderSchedule(s))}`;
  }

  private _showRepeatDaysOnCard(): boolean {
    return this.config?.show_repeat_days_on_card !== false;
  }

  /** Lien texte « Configurer les plages » sous la frise (défaut: affiché). La frise reste toujours visible. */
  private _showSlotsOnCard(): boolean {
    return this.config?.show_slots_on_card !== false;
  }

  /** Clic sur la zone planning → éditeur (uniquement si le lien est masqué ; défaut: activé). */
  private _cardClickOpensEditor(): boolean {
    return this.config?.card_click_opens_editor !== false;
  }

  private _scheduleClickToOpenEditor(): boolean {
    return !this._showSlotsOnCard() && this._cardClickOpensEditor();
  }

  /**
   * Ouverture au clic : lien masqué et option clic activée ; ignore les contrôles
   * (switch, bouton, champ, composant `ha-*`).
   */
  private _onScheduleShellPointerDown(ev: PointerEvent, schedule: Schedule) {
    if (!this._scheduleClickToOpenEditor()) {
      return;
    }
    if (ev.button !== 0) {
      return;
    }
    const root = ev.currentTarget as HTMLElement;
    for (const node of ev.composedPath()) {
      if (node === root) {
        break;
      }
      if (!(node instanceof Element)) {
        continue;
      }
      const tag = node.tagName.toLowerCase();
      if (
        tag === 'button' ||
        tag === 'a' ||
        tag === 'input' ||
        tag === 'select' ||
        tag === 'textarea'
      ) {
        return;
      }
      if (tag.startsWith('ha-')) {
        return;
      }
    }
    this.openVisualEditor(schedule);
  }

  private _onScheduleShellKeydown(ev: KeyboardEvent, schedule: Schedule) {
    if (!this._scheduleClickToOpenEditor()) {
      return;
    }
    if (ev.key !== 'Enter' && ev.key !== ' ') {
      return;
    }
    ev.preventDefault();
    this.openVisualEditor(schedule);
  }

  /** Jours affichés sur la carte : `all` si absent / complet sur la semaine. */
  private scheduleRepeatDaysDisplay(schedule: Schedule): number[] | 'all' {
    const raw = schedule.repeat_days;
    if (!raw || raw.length === 0) {
      return 'all';
    }
    const uniq = [
      ...new Set(
        raw.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
      ),
    ].sort((a, b) => a - b);
    if (uniq.length === 0) {
      return 'all';
    }
    if (uniq.length === 7) {
      return 'all';
    }
    return uniq;
  }

  private renderScheduleRepeatDays(schedule: Schedule) {
    if (!this._showRepeatDaysOnCard()) {
      return html``;
    }
    const hass = this.hass;
    const mode = this.scheduleRepeatDaysDisplay(schedule);
    return html`
      <div
        class="sm-schedule-repeat-days"
        role="group"
        aria-label=${msg(hass, 'card.repeat_days_row_aria')}
      >
        ${mode === 'all'
          ? html`<span class="sm-schedule-repeat-pill sm-schedule-repeat-pill--all">${msg(
              hass,
              'card.repeat_days_all_short'
            )}</span>`
          : mode.map(
              (d) =>
                html`<span class="sm-schedule-repeat-pill">${weekdayShort(hass, d)}</span>`
            )}
      </div>
    `;
  }

  /**
   * Barre d’heures sous la frise (même structure que scheduler-card : flex 18px de haut).
   */
  private renderSchedulerTimeScale(mode: 'dashboard' | 'editor') {
    const ticks =
      mode === 'editor'
        ? timelineScaleTicksForWidth(this._editorFriseWidth)
        : DEFAULT_TIMELINE_SCALE_TICKS;
    return html`
      <div class="sm-time-bar" aria-hidden="true">
        ${ticks.map((t, i) => {
          const cls =
            i === 0
              ? 'sm-time-bar-label sm-time-bar-label--left'
              : i === ticks.length - 1
                ? 'sm-time-bar-label sm-time-bar-label--right'
                : 'sm-time-bar-label';
          return html`<span class=${cls}>${t.label}</span>`;
        })}
      </div>
    `;
  }

  /** Ordre de peinture : plages plus étroites au-dessus (données anciennes encore chevauchées). */
  private sortTimelineSegmentsForPaint(segments: TimelineSegment[]): TimelineSegment[] {
    return [...segments].sort((a, b) =>
      a.leftPct !== b.leftPct ? a.leftPct - b.leftPct : b.widthPct - a.widthPct
    );
  }

  /** Positionnement réel sur la journée (le flex-grow seul faisait occuper toute la barre à un seul bloc). */
  private schedulerSlotAbsoluteStyle(
    leftPct: number,
    widthPct: number,
    fill: string,
    nowActive = false
  ) {
    return styleMap({
      position: 'absolute',
      left: `${leftPct}%`,
      width: `${widthPct}%`,
      top: '0',
      height: '100%',
      boxSizing: 'border-box',
      background: fill,
      ...(nowActive ? nowActiveRingCssVars(fill) : {}),
    });
  }

  /** Coins arrondis uniquement sur le premier / dernier segment visible (gauche → droite). */
  private segmentCapIndices(segments: TimelineSegment[]): {
    capStart: Set<number>;
    capEnd: Set<number>;
  } {
    if (!segments.length) {
      return { capStart: new Set(), capEnd: new Set() };
    }
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let iStart = 0;
    let iEnd = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.leftPct < minLeft) {
        minLeft = seg.leftPct;
        iStart = i;
      }
      const right = seg.leftPct + seg.widthPct;
      if (right > maxRight) {
        maxRight = right;
        iEnd = i;
      }
    }
    return {
      capStart: new Set([iStart]),
      capEnd: new Set([iEnd]),
    };
  }

  private renderDayTimeline(blocks: TimeBlock[]) {
    const segments = this.sortTimelineSegmentsForPaint(blocksToTimelineSegments(blocks));
    const caps = this.segmentCapIndices(segments);
    const nowPct = nowPercentOfDay();
    const nowSeg = paintOrderSegmentIndexForNowPct(segments, nowPct);
    return html`
      <div class="timeline-frise sm-scheduler-frise" role="img" aria-label=${msg(this.hass, 'card.timeline_aria')}>
        <div class="sm-scheduler-track">
          <div class="sm-scheduler-bar">
            ${segments.map((s, i) => {
              const blk = blocks[s.blockIndex];
              const fill = blk ? blockTimelineFill(blk) : `hsl(${s.hue}, 58%, 42%)`;
              const capS = caps.capStart.has(i) ? 'sm-slot--cap-start' : '';
              const capE = caps.capEnd.has(i) ? 'sm-slot--cap-end' : '';
              const nowActive = nowSeg === i ? 'sm-slot--now-active' : '';
              return html`
                <div
                  class="sm-slot ${capS} ${capE} ${nowActive}"
                  style=${this.schedulerSlotAbsoluteStyle(s.leftPct, s.widthPct, fill, nowSeg === i)}
                  title=${s.label}
                >
                  <span class="sm-slot-label">${s.label}</span>
                </div>
              `;
            })}
          </div>
        </div>
        ${this.renderSchedulerTimeScale('dashboard')}
      </div>
    `;
  }

  private blocksToPayload(blocks: TimeBlock[]): TimeBlockServicePayload[] {
    return (blocks || []).map((b) => {
      const actions = (b.actions || [])
        .filter((a) => String(a.action_type ?? '').trim())
        .map((a) => ({
          action_type: a.action_type,
          action_payload:
            typeof a.action_payload === 'object' && a.action_payload !== null
              ? (a.action_payload as Record<string, unknown>)
              : {},
          ...(a.id ? { id: a.id } : {}),
        }));
      return {
        start_time: normalizeTimeForHa(String(b.start_time)),
        end_time: normalizeTimeForHa(String(b.end_time)),
        actions,
        ...(b.id ? { id: b.id } : {}),
      };
    });
  }

  private renderSchedule(schedule: Schedule | undefined) {
    if (!schedule) {
      return html``;
    }

    const blocks = schedule.time_blocks || [];
    const showSlots = this._showSlotsOnCard();
    const clickToOpen = this._scheduleClickToOpenEditor();

    return html`
      <div
        class="schedule${clickToOpen ? ' schedule--tap-opens-editor' : ''}"
        tabindex=${clickToOpen ? 0 : nothing}
        role=${clickToOpen ? 'button' : nothing}
        aria-label=${clickToOpen
          ? msg(this.hass, 'card.open_schedule_editor_aria', {
              name: schedule.name,
            })
          : nothing}
        @pointerdown=${(e: PointerEvent) =>
          this._onScheduleShellPointerDown(e, schedule)}
        @keydown=${(e: KeyboardEvent) => this._onScheduleShellKeydown(e, schedule)}
      >
        <div class="schedule-header">
          <span>${schedule.name}</span>
          ${this._showScheduleEnableToggle()
            ? html`
                <div class="schedule-actions">
                  <ha-switch
                    .checked=${schedule.enabled}
                    @change=${(e: Event) =>
                      void this.toggleSchedule(
                        schedule.id,
                        haSwitchCheckedFromChangeEvent(e)
                      )}
                  ></ha-switch>
                </div>
              `
            : html``}
        </div>
        ${this.renderScheduleRepeatDays(schedule)}
        ${blocks.length
          ? html`${this.renderDayTimeline(blocks)}`
          : showSlots
            ? html`
                <div class="empty-hint">
                  ${msg(this.hass, 'card.no_slots_hint')}
                </div>
              `
            : clickToOpen
              ? html`
                  <div class="empty-hint compact-empty-hint">
                    ${msg(this.hass, 'card.compact_empty_hint')}
                  </div>
                `
              : html``}
        ${showSlots
          ? html`
              <button
                type="button"
                class="btn-open-config"
                @click=${() => this.openVisualEditor(schedule)}
              >
                ${msg(this.hass, 'card.configure_slots')}
              </button>
            `
          : html``}
      </div>
    `;
  }

  private async toggleSchedule(scheduleId: string, enabled: boolean) {
    try {
      if (enabled) {
        await this.services().enableSchedule(scheduleId);
      } else {
        await this.services().disableSchedule(scheduleId);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('schedule_manager service call failed', e);
    }
  }

  private openVisualEditor(schedule: Schedule) {
    let blocks = JSON.parse(JSON.stringify(schedule.time_blocks || [])) as TimeBlock[];
    if (!blocks.length) {
      blocks = [defaultFullDayBlock()];
    } else {
      blocks = blocks.map((b) => {
        const n = normalizeTimeBlock(b as unknown as Record<string, unknown>);
        return {
          ...n,
          start_time: normalizeTimeForHa(String(n.start_time ?? '')),
          end_time: normalizeTimeForHa(String(n.end_time ?? '')),
        };
      });
    }
    this._visualEdit = {
      scheduleId: schedule.id,
      blocks,
      repeatDays: [
        ...(schedule.repeat_days && schedule.repeat_days.length > 0
          ? schedule.repeat_days
          : [0, 1, 2, 3, 4, 5, 6]),
      ],
      selectedIndex: 0,
      selectedActionIndex: 0,
    };
  }

  private closeVisualEditor() {
    this.endBoundaryDrag();
    this.endSegmentDrag();
    this._detachEditorFriseObserver();
    this._editorFriseWidth = 0;
    this._visualEdit = null;
    this._actionWizardOpen = false;
    this.closeEntityAddPicker();
  }

  private endBoundaryDrag() {
    const d = this._boundaryDrag;
    window.removeEventListener('pointermove', this._onBoundaryMove);
    window.removeEventListener('pointerup', this._onBoundaryUp);
    window.removeEventListener('pointercancel', this._onBoundaryUp);
    if (d) {
      try {
        d.handle.releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    this._boundaryDrag = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.endBoundaryDrag();
    this.endSegmentDrag();
    this._detachEditorFriseObserver();
  }

  private endSegmentDrag() {
    window.removeEventListener('pointermove', this._onSegmentDragMove);
    window.removeEventListener('pointerup', this._onSegmentDragUp);
    window.removeEventListener('pointercancel', this._onSegmentDragUp);
    const d = this._segmentDrag;
    if (d) {
      try {
        d.slotEl.releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    this._segmentDrag = null;
  }

  private _onSegmentDragMove = (ev: PointerEvent) => {
    const d = this._segmentDrag;
    if (!d || !this._visualEdit || ev.pointerId !== d.pointerId) {
      return;
    }
    const rect = d.rail.getBoundingClientRect();
    const rawDelta =
      ((ev.clientX - d.startClientX) / Math.max(1, rect.width)) * MINUTES_PER_DAY;
    const deltaM = snapMinutesToGrid(Math.round(rawDelta), TIMELINE_DRAG_SNAP_MINUTES);
    const dur = d.origEndM - d.origStartM;
    if (dur <= 0) {
      return;
    }
    let newStart = d.origStartM + deltaM;
    let newEnd = newStart + dur;
    newStart = snapMinutesToGrid(Math.round(newStart), TIMELINE_DRAG_SNAP_MINUTES);
    newEnd = newStart + dur;
    const maxStart = MINUTES_PER_DAY - dur;
    newStart = Math.max(0, Math.min(maxStart, newStart));
    newEnd = newStart + dur;
    if (newEnd > MINUTES_PER_DAY) {
      newEnd = MINUTES_PER_DAY;
      newStart = Math.max(0, newEnd - dur);
    }

    const resolved = applyDragMoveWithOptionalSwap(
      this._visualEdit.blocks,
      d.blockIdx,
      newStart,
      newEnd,
      d.origStartM,
      d.origEndM
    );
    if (!resolved) {
      return;
    }
    this._visualEdit = { ...this._visualEdit, blocks: resolved };
    this.requestUpdate();
  };

  private _onSegmentDragUp = (ev: PointerEvent) => {
    const d = this._segmentDrag;
    if (d && ev.pointerId === d.pointerId) {
      const rect = d.rail.getBoundingClientRect();
      const rawDelta =
        ((ev.clientX - d.startClientX) / Math.max(1, rect.width)) * MINUTES_PER_DAY;
      if (Math.abs(rawDelta) > 4) {
        this._suppressSlotClick = true;
      }
    }
    this.endSegmentDrag();
  };

  private onSlotPointerDown(ev: PointerEvent, blockIdx: number) {
    if (!this._visualEdit || blockIdx !== this._visualEdit.selectedIndex) {
      return;
    }
    if (ev.button !== 0) {
      return;
    }
    const b = this._visualEdit.blocks[blockIdx];
    if (!b || isOvernightBlock(b)) {
      return;
    }
    const rail = (ev.currentTarget as HTMLElement).closest('.sm-scheduler-track') as HTMLElement | null;
    if (!rail) {
      return;
    }
    const s0 = timeStringToMinutes(b.start_time);
    const e0 = timeStringToMinutes(b.end_time);
    if (e0 <= s0) {
      return;
    }
    this.endBoundaryDrag();
    this.endSegmentDrag();
    const slotEl = ev.currentTarget as HTMLElement;
    this._segmentDrag = {
      pointerId: ev.pointerId,
      blockIdx,
      rail,
      slotEl,
      startClientX: ev.clientX,
      origStartM: s0,
      origEndM: e0,
    };
    try {
      slotEl.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    window.addEventListener('pointermove', this._onSegmentDragMove);
    window.addEventListener('pointerup', this._onSegmentDragUp);
    window.addEventListener('pointercancel', this._onSegmentDragUp);
  }

  private onSlotClick(ev: Event, blockIdx: number) {
    if (this._suppressSlotClick) {
      this._suppressSlotClick = false;
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    this.visualSelectBlock(blockIdx);
  }

  private _detachEditorFriseObserver() {
    this._editorFriseResizeObserver?.disconnect();
    this._editorFriseResizeObserver = undefined;
  }

  private _syncEditorFriseObserver() {
    this._detachEditorFriseObserver();
    if (!this._visualEdit) {
      return;
    }
    requestAnimationFrame(() => {
      if (!this._visualEdit) {
        return;
      }
      const el = this.shadowRoot?.querySelector('.sm-editor-frise');
      if (!el) {
        return;
      }
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width ?? 0;
        if (Math.abs(w - this._editorFriseWidth) > 0.5) {
          this._editorFriseWidth = w;
        }
      });
      ro.observe(el);
      this._editorFriseResizeObserver = ro;
      const w = el.getBoundingClientRect().width;
      if (w > 0 && Math.abs(w - this._editorFriseWidth) > 0.5) {
        this._editorFriseWidth = w;
      }
    });
  }

  private onResizePointerDown(ev: PointerEvent, h: TimelineResizeHandle) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!this._visualEdit) {
      return;
    }
    const rail = (ev.currentTarget as HTMLElement).closest(
      '.sm-scheduler-track'
    ) as HTMLElement | null;
    if (!rail) {
      return;
    }
    this.endBoundaryDrag();
    this.endSegmentDrag();
    const handle = ev.currentTarget as HTMLElement;
    if (h.kind === 'junction') {
      this._boundaryDrag = {
        pointerId: ev.pointerId,
        mode: 'junction',
        leftIdx: h.leftBlockIndex,
        rightIdx: h.rightBlockIndex,
        minM: h.minMinute,
        maxM: h.maxMinute,
        rail,
        handle,
      };
    } else if (h.kind === 'start') {
      this._boundaryDrag = {
        pointerId: ev.pointerId,
        mode: 'start',
        blockIdx: h.blockIndex,
        minM: h.minMinute,
        maxM: h.maxMinute,
        rail,
        handle,
      };
    } else {
      this._boundaryDrag = {
        pointerId: ev.pointerId,
        mode: 'end',
        blockIdx: h.blockIndex,
        minM: h.minMinute,
        maxM: h.maxMinute,
        rail,
        handle,
      };
    }
    handle.setPointerCapture(ev.pointerId);
    window.addEventListener('pointermove', this._onBoundaryMove);
    window.addEventListener('pointerup', this._onBoundaryUp);
    window.addEventListener('pointercancel', this._onBoundaryUp);
  }

  private visualToggleDay(day: number) {
    if (!this._visualEdit) {
      return;
    }
    let days = [...this._visualEdit.repeatDays];
    if (days.includes(day)) {
      days = days.filter((d) => d !== day);
    } else {
      days = [...days, day].sort((a, b) => a - b);
    }
    if (days.length === 0) {
      alert(msg(this.hass, 'card.alert_select_day'));
      return;
    }
    this._visualEdit = { ...this._visualEdit, repeatDays: days };
  }

  private visualSelectBlock(index: number) {
    if (!this._visualEdit) {
      return;
    }
    const max = this._visualEdit.blocks.length - 1;
    const idx = Math.max(0, Math.min(index, max));
    if (idx === this._visualEdit.selectedIndex) {
      return;
    }
    this.closeEntityAddPicker();
    this._visualEdit = {
      ...this._visualEdit,
      selectedIndex: idx,
      selectedActionIndex: 0,
    };
  }

  private visualPatchBlockFields(
    patch: Partial<Pick<TimeBlock, 'start_time' | 'end_time' | 'id'>>
  ) {
    if (!this._visualEdit) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const cur = this._visualEdit.blocks[sel];
    if (!cur) {
      return;
    }
    const next = { ...cur, ...patch } as TimeBlock;
    if (!isOvernightBlock(next) && !sameDayBlockIntervalExclusiveEnd(next)) {
      alert(msg(this.hass, 'card.alert_end_after_start'));
      return;
    }
    const trial = [...this._visualEdit.blocks];
    trial[sel] = next;
    if (hasOverlappingSameDayBlocks(trial)) {
      alert(msg(this.hass, 'card.alert_overlap'));
      return;
    }
    this._visualEdit = { ...this._visualEdit, blocks: trial };
  }

  private visualPatchSelectedAction(
    patch: Partial<BlockAction>,
    actionIndexOverride?: number
  ) {
    if (!this._visualEdit) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const maxAi = Math.max(0, (this._visualEdit.blocks[sel]?.actions?.length ?? 1) - 1);
    const ai = Math.min(
      actionIndexOverride !== undefined
        ? actionIndexOverride
        : this._visualEdit.selectedActionIndex,
      maxAi
    );
    const cur = this._visualEdit.blocks[sel];
    if (!cur?.actions?.length) {
      return;
    }
    const actions = cur.actions.map((a, i) =>
      i === ai ? ({ ...a, ...patch } as BlockAction) : a
    );
    const next = { ...cur, actions };
    const trial = [...this._visualEdit.blocks];
    trial[sel] = next;
    this._visualEdit = { ...this._visualEdit, blocks: trial };
  }

  private visualSelectAction(ai: number) {
    if (!this._visualEdit) {
      return;
    }
    const b = this._visualEdit.blocks[this._visualEdit.selectedIndex];
    if (!b?.actions?.length) {
      return;
    }
    const max = b.actions.length - 1;
    const next = Math.max(0, Math.min(ai, max));
    if (next === this._visualEdit.selectedActionIndex) {
      return;
    }
    this.closeEntityAddPicker();
    this._visualEdit = {
      ...this._visualEdit,
      selectedActionIndex: next,
    };
  }

  private visualAddAction() {
    if (!this._visualEdit) {
      return;
    }
    const bi = this._visualEdit.selectedIndex;
    const b = this._visualEdit.blocks[bi];
    if (!b) {
      return;
    }
    const actions = [...b.actions, newEmptyAction()];
    const next = { ...b, actions };
    const trial = [...this._visualEdit.blocks];
    trial[bi] = next;
    this.closeEntityAddPicker();
    this._visualEdit = {
      ...this._visualEdit,
      blocks: trial,
      selectedActionIndex: actions.length - 1,
    };
  }

  private visualRemoveAction(ai: number) {
    if (!this._visualEdit) {
      return;
    }
    const bi = this._visualEdit.selectedIndex;
    const b = this._visualEdit.blocks[bi];
    if (!b || b.actions.length <= 1) {
      alert(msg(this.hass, 'card.alert_min_one_action'));
      return;
    }
    const actions = b.actions.filter((_, i) => i !== ai);
    const next = { ...b, actions };
    const trial = [...this._visualEdit.blocks];
    trial[bi] = next;
    let selectedActionIndex = this._visualEdit.selectedActionIndex;
    if (selectedActionIndex >= actions.length) {
      selectedActionIndex = actions.length - 1;
    } else if (ai < selectedActionIndex) {
      selectedActionIndex -= 1;
    }
    this.closeEntityAddPicker();
    this._visualEdit = { ...this._visualEdit, blocks: trial, selectedActionIndex };
  }

  private visualAddBlock() {
    if (!this._visualEdit) {
      return;
    }
    const gap = suggestGapIntervalMinutes(this._visualEdit.blocks, 60);
    let nb: TimeBlock;
    let nextBlocks: TimeBlock[];
    let selectedIndex: number;

    if (gap) {
      nb = {
        start_time: minuteToHaTimeForSchedule(gap.start),
        end_time: minuteToHaTimeForSchedule(gap.end),
        actions: [newEmptyAction()],
      };
      nextBlocks = [...this._visualEdit.blocks, nb];
      selectedIndex = nextBlocks.length - 1;
      if (hasOverlappingSameDayBlocks(nextBlocks)) {
        alert(msg(this.hass, 'card.alert_cannot_add_overlap'));
        return;
      }
    } else {
      const split = tryInsertSlotAtDayStart(
        this._visualEdit.blocks,
        TIMELINE_DRAG_SNAP_MINUTES
      );
      if (!split) {
        alert(msg(this.hass, 'card.alert_day_full'));
        return;
      }
      nextBlocks = split;
      selectedIndex = 0;
      nb = split[0];
    }

    const fp = blockFingerprint(nb);
    for (const b of this._visualEdit.blocks) {
      if (blockFingerprint(b) === fp) {
        alert(msg(this.hass, 'card.alert_duplicate_slot'));
        return;
      }
    }
    this.closeEntityAddPicker();
    this._visualEdit = {
      ...this._visualEdit,
      blocks: nextBlocks,
      selectedIndex,
      selectedActionIndex: 0,
    };
  }

  private visualRemoveSelected() {
    if (!this._visualEdit) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const nextBlocks = this._visualEdit.blocks.filter((_, i) => i !== sel);
    let nextSel = sel;
    if (nextSel >= nextBlocks.length) {
      nextSel = Math.max(0, nextBlocks.length - 1);
    }
    this.closeEntityAddPicker();
    this._visualEdit = {
      ...this._visualEdit,
      blocks: nextBlocks,
      selectedIndex: nextSel,
      selectedActionIndex: 0,
    };
  }

  /** Première entité ciblée dans le payload (pour l’UI et les services). */
  private primaryEntityFromAction(action: BlockAction): string {
    return entityIdsFromPayload(action.action_payload)[0] ?? '';
  }

  /** Entités `hass.states` compatibles avec l’action, hors `excludeEntityIds` (déjà ciblées). */
  private compatibleEntityChoicesForAction(
    action: BlockAction,
    excludeEntityIds: readonly string[]
  ): { id: string; name: string }[] {
    const hass = this.hass;
    if (!hass) {
      return [];
    }
    const actionType = String(action.action_type ?? '').trim();
    const omit = new Set(excludeEntityIds.filter((id) => id.includes('.')));
    return listEntityIdsForAction(hass, actionType)
      .filter((id) => !omit.has(id))
      .map((id) => ({ id, name: friendlyEntityName(hass, id) }));
  }

  private quickPickEntityAppend(actionIndex: number, entityId: string) {
    const ev = new CustomEvent<{ value: string }>('value-changed', {
      detail: { value: entityId },
    });
    if (this.visualAppendEntityAt(actionIndex, ev as CustomEvent<{ value?: string }>)) {
      this.closeEntityAddPicker();
    }
  }

  private quickPickEntityReplace(actionIndex: number, oldEntityId: string, entityId: string) {
    const ev = new CustomEvent<{ value: string }>('value-changed', {
      detail: { value: entityId },
    });
    if (this.visualReplaceEntityAt(actionIndex, oldEntityId, ev as CustomEvent<{ value?: string }>)) {
      this.closeEntityAddPicker();
    }
  }

  private renderQuickEntityPickerPanel(
    action: BlockAction,
    actionIndex: number,
    mode: 'append' | 'replace',
    oldEntityId?: string
  ) {
    const hass = this.hass;
    if (!hass) {
      return html``;
    }
    const payloadIds = entityIdsFromPayload(action.action_payload);
    const exclude = payloadIds;
    const rows = this.compatibleEntityChoicesForAction(action, exclude);
    const q = this._entityManualListSearch.trim().toLowerCase();
    const emptyQ = q ? msg(hass, 'card.entity_manual_empty_q') : '';
    const filtered =
      q === ''
        ? rows
        : rows.filter(
            (r) =>
              r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
          );
    return html`
      <div class="sm-entity-manual-picker">
        <div class="sm-entity-manual-search">
          <ha-icon class="sm-entity-manual-search-icon" icon="mdi:magnify"></ha-icon>
          <input
            type="search"
            class="sm-entity-manual-filter"
            autocomplete="off"
            spellcheck="false"
            aria-label=${msg(hass, 'card.entity_search_aria')}
            placeholder=${msg(hass, 'card.entity_search_placeholder')}
            .value=${this._entityManualListSearch}
            @input=${(e: Event) => {
              this._entityManualListSearch = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="sm-entity-manual-list" role="listbox" aria-label=${msg(hass, 'card.entity_list_aria')}>
          ${filtered.length === 0
            ? html`<p class="sm-entity-manual-empty">
                ${msg(hass, 'card.entity_manual_empty', { q: emptyQ })}
              </p>`
            : filtered.map((r) => {
                const st = hass.states[r.id];
                const dom = r.id.includes('.') ? (r.id.split('.')[0] ?? '') : '';
                return html`
                  <button
                    type="button"
                    role="option"
                    class="sm-entity-manual-row"
                    @click=${() => {
                      if (mode === 'append') {
                        this.quickPickEntityAppend(actionIndex, r.id);
                      } else if (oldEntityId) {
                        this.quickPickEntityReplace(actionIndex, oldEntityId, r.id);
                      }
                    }}
                  >
                    ${st
                      ? html`<state-badge
                          class="sm-entity-manual-badge"
                          .hass=${hass}
                          .stateObj=${st}
                        ></state-badge>`
                      : html`<div class="sm-entity-manual-icon-fallback">
                          <ha-icon
                            icon=${entityIcon(hass, r.id) ??
                            (dom ? domainIcon(dom) : 'mdi:shape-outline')}
                          ></ha-icon>
                        </div>`}
                    <div class="sm-entity-manual-row-text">
                      <span class="sm-entity-manual-row-name">${r.name}</span>
                      <span class="sm-entity-manual-row-id">${r.id}</span>
                    </div>
                  </button>
                `;
              })}
        </div>
      </div>
    `;
  }

  private visualAppendEntity(
    ev: CustomEvent<{ value?: string }>,
    actionIndexOverride?: number
  ): boolean {
    if (!this._visualEdit || !this.hass) {
      return false;
    }
    const raw =
      ev.detail?.value ??
      ((ev.target as unknown as { value?: string })?.value ?? '');
    const v = String(raw).trim();
    if (!v) {
      return false;
    }
    const sel = this._visualEdit.selectedIndex;
    const block = this._visualEdit.blocks[sel];
    const maxAi = Math.max(0, (block?.actions?.length ?? 1) - 1);
    const ai = Math.min(
      actionIndexOverride !== undefined
        ? Math.max(0, Math.min(actionIndexOverride, maxAi))
        : Math.min(this._visualEdit.selectedActionIndex, maxAi),
      maxAi
    );
    const action = block?.actions?.[ai];
    if (!block || !action || !String(action.action_type ?? '').trim()) {
      return false;
    }
    const ids = entityIdsFromPayload(action.action_payload);
    if (ids.includes(v)) {
      return false;
    }
    const base =
      typeof action.action_payload === 'object' && action.action_payload !== null
        ? { ...(action.action_payload as Record<string, unknown>) }
        : {};
    const nextIds = [...ids, v];
    base.entity_id = nextIds.length === 1 ? nextIds[0] : nextIds;
    this.visualPatchSelectedAction({ action_payload: base }, ai);
    return true;
  }

  private visualReplaceEntity(
    oldEntityId: string,
    ev: CustomEvent<{ value?: string }>,
    actionIndexOverride?: number
  ): boolean {
    if (!this._visualEdit || !this.hass) {
      return false;
    }
    const raw =
      ev.detail?.value ??
      ((ev.target as unknown as { value?: string })?.value ?? '');
    const v = String(raw).trim();
    if (!v || v === oldEntityId) {
      return false;
    }
    const sel = this._visualEdit.selectedIndex;
    const block = this._visualEdit.blocks[sel];
    const maxAi = Math.max(0, (block?.actions?.length ?? 1) - 1);
    const ai = Math.min(
      actionIndexOverride !== undefined
        ? Math.max(0, Math.min(actionIndexOverride, maxAi))
        : Math.min(this._visualEdit.selectedActionIndex, maxAi),
      maxAi
    );
    const action = block?.actions?.[ai];
    if (!block || !action || !String(action.action_type ?? '').trim()) {
      return false;
    }
    const ids = entityIdsFromPayload(action.action_payload);
    if (!ids.includes(oldEntityId) || ids.includes(v)) {
      return false;
    }
    const nextIds = ids.map((id) => (id === oldEntityId ? v : id));
    const base =
      typeof action.action_payload === 'object' && action.action_payload !== null
        ? { ...(action.action_payload as Record<string, unknown>) }
        : {};
    base.entity_id = nextIds.length === 1 ? nextIds[0] : nextIds;
    this.visualPatchSelectedAction({ action_payload: base }, ai);
    return true;
  }

  private visualRemoveEntityChip(
    entityId: string,
    actionIndexOverride?: number
  ) {
    if (!this._visualEdit) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const block = this._visualEdit.blocks[sel];
    const maxAi = Math.max(0, (block?.actions?.length ?? 1) - 1);
    const ai = Math.min(
      actionIndexOverride !== undefined
        ? Math.max(0, Math.min(actionIndexOverride, maxAi))
        : Math.min(this._visualEdit.selectedActionIndex, maxAi),
      maxAi
    );
    const action = block?.actions?.[ai];
    if (!block || !action) {
      return;
    }
    const ids = entityIdsFromPayload(action.action_payload).filter((e) => e !== entityId);
    if (ids.length === 0) {
      alert(msg(this.hass, 'card.alert_min_one_entity'));
      return;
    }
    const base =
      typeof action.action_payload === 'object' && action.action_payload !== null
        ? { ...(action.action_payload as Record<string, unknown>) }
        : {};
    base.entity_id = ids.length === 1 ? ids[0] : ids;
    this.visualPatchSelectedAction({ action_payload: base }, ai);
  }

  /** Modes préréglés exposés par l’entité climate (pour l’étape assistant). */
  private climatePresetModesForEntityId(entityId: string): string[] | null {
    const hass = this.hass;
    if (!hass) {
      return null;
    }
    return climatePresetModesList(hass, entityId);
  }

  private applyWizardSelection(
    entityId: string,
    serviceShort: string,
    climatePresetMode?: string
  ) {
    if (!this._visualEdit || !this.hass || !entityId.includes('.')) {
      return;
    }
    const domain = entityId.split('.')[0] ?? '';
    if (!domain) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const maxAi = Math.max(0, (this._visualEdit.blocks[sel]?.actions?.length ?? 1) - 1);
    const ai = Math.min(Math.max(0, this._actionWizardTargetActionIndex), maxAi);
    const block = this._visualEdit.blocks[sel];
    const curAction = block?.actions?.[ai];
    if (!block || !curAction) {
      return;
    }

    const payload = stripPayloadForNewService(
      curAction.action_payload,
      entityId,
      SCHEDULE_MANAGER_COLOR_KEY
    );
    if (
      domain === 'climate' &&
      serviceShort === 'set_preset_mode' &&
      climatePresetMode !== undefined
    ) {
      payload.preset_mode = climatePresetMode;
    } else {
      applyDefaultFieldsForService(domain, serviceShort, entityId, payload, this.hass);
    }

    this.visualPatchSelectedAction(
      {
        action_type: `${domain}.${serviceShort}`,
        action_payload: payload,
      },
      ai
    );
    this.closeActionWizard();
  }

  private openActionWizard() {
    if (!this._visualEdit || !this.hass) {
      return;
    }
    this.closeEntityAddPicker();
    const bi = this._visualEdit.selectedIndex;
    const n = this._visualEdit.blocks[bi]?.actions?.length ?? 0;
    const maxAi = Math.max(0, n - 1);
    this._actionWizardTargetActionIndex = Math.min(
      Math.max(0, this._visualEdit.selectedActionIndex),
      maxAi
    );
    this._actionWizardOpen = true;
    this._actionWizardStep = 'domain';
    this._actionWizardSearch = '';
    this._actionWizardDomain = null;
    this._actionWizardServiceShort = null;
    this._actionWizardEntityId = null;
  }

  private closeActionWizard() {
    this._actionWizardOpen = false;
  }

  private actionWizardBack() {
    if (this._actionWizardStep === 'climate_preset') {
      this._actionWizardStep = 'entity';
      this._actionWizardEntityId = null;
      this._actionWizardSearch = '';
      return;
    }
    if (this._actionWizardStep === 'entity') {
      this._actionWizardStep = 'service';
      this._actionWizardEntityId = null;
      this._actionWizardSearch = '';
      return;
    }
    if (this._actionWizardStep === 'service') {
      this._actionWizardStep = 'domain';
      this._actionWizardDomain = null;
      this._actionWizardServiceShort = null;
      this._actionWizardSearch = '';
    }
  }

  private actionWizardPickDomain(domain: string) {
    this._actionWizardDomain = domain;
    this._actionWizardServiceShort = null;
    this._actionWizardStep = 'service';
    this._actionWizardSearch = '';
  }

  private actionWizardPickService(serviceShort: string) {
    this._actionWizardServiceShort = serviceShort;
    this._actionWizardStep = 'entity';
    this._actionWizardEntityId = null;
    this._actionWizardSearch = '';
  }

  private actionWizardPickEntity(eid: string) {
    const domain = this._actionWizardDomain;
    const svc = this._actionWizardServiceShort;
    if (!domain || !svc) {
      return;
    }
    this._actionWizardEntityId = eid;
    if (svc === 'set_preset_mode' && domain === 'climate') {
      const modes = this.climatePresetModesForEntityId(eid);
      if (modes && modes.length > 0) {
        this._actionWizardStep = 'climate_preset';
        this._actionWizardSearch = '';
        return;
      }
    }
    this.applyWizardSelection(eid, svc);
  }

  private actionWizardApplyClimatePreset(presetMode: string) {
    const id = this._actionWizardEntityId;
    const svc = this._actionWizardServiceShort;
    if (!id || svc !== 'set_preset_mode') {
      return;
    }
    this.applyWizardSelection(id, 'set_preset_mode', presetMode);
  }

  private _onWizardSearchInput(ev: Event) {
    this._actionWizardSearch = (ev.target as HTMLInputElement).value;
  }

  private _onWizardOverlayKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.closeActionWizard();
    }
  }

  private renderActionSummary(selected: BlockAction) {
    if (!String(selected.action_type ?? '').trim()) {
      return html``;
    }
    const hass = this.hass;
    if (!hass) {
      return html``;
    }
    const primary = this.primaryEntityFromAction(selected);
    const parsed = parseDomainService(selected.action_type);
    const primaryDomain = primary.includes('.')
      ? primary.split('.')[0] ?? ''
      : '';
    const icon = primary
      ? entityIcon(hass, primary) ??
        (primaryDomain ? domainIcon(primaryDomain) : undefined) ??
        'mdi:gesture-tap-button'
      : 'mdi:gesture-tap-button';
    const title = primary
      ? friendlyEntityName(hass, primary)
      : msg(hass, 'card.no_entity_selected');
    const actionLine = parsed
      ? servicePrimaryLabel(hass, parsed.domain, parsed.service)
      : selected.action_type || '—';

    return html`
      <div class="sm-action-summary">
        <ha-icon class="sm-action-summary-icon" .icon=${icon}></ha-icon>
        <div class="sm-action-summary-text">
          <div class="sm-action-summary-title">${title}</div>
          <div class="sm-action-summary-sub">
            <span>${actionLine}</span>
            ${selected.action_type
              ? html`<code class="sm-action-tech">${selected.action_type}</code>`
              : null}
          </div>
        </div>
      </div>
    `;
  }

  private formatActionTabTitle(action: BlockAction, index: number): string {
    const at = String(action.action_type ?? '').trim();
    if (!at) {
      return msg(this.hass, 'card.action_tab_fallback', { n: String(index + 1) });
    }
    const segs = at.split('.');
    const tail = at.includes('.') ? segs[segs.length - 1] ?? at : at;
    return tail.length > 20 ? `${tail.slice(0, 18)}…` : tail;
  }

  /** Une seule action encore sans service : pas de liste — uniquement le bouton principal. */
  private isSinglePlaceholderAction(selected: TimeBlock): boolean {
    const actions = selected.actions || [];
    return (
      actions.length === 1 && !String(actions[0]?.action_type ?? '').trim()
    );
  }

  private openActionWizardAt(actionIndex: number) {
    this.visualSelectAction(actionIndex);
    this.openActionWizard();
  }

  private visualAppendEntityAt(
    actionIndex: number,
    ev: CustomEvent<{ value?: string }>
  ): boolean {
    return this.visualAppendEntity(ev, actionIndex);
  }

  private visualReplaceEntityAt(
    actionIndex: number,
    oldEntityId: string,
    ev: CustomEvent<{ value?: string }>
  ): boolean {
    return this.visualReplaceEntity(oldEntityId, ev, actionIndex);
  }

  private entityAddPickerKey(blockIdx: number, actionIdx: number): string {
    return `${blockIdx}-${actionIdx}`;
  }

  private closeEntityAddPicker(): void {
    this._entityAddPickerOpenKey = null;
    this._entityPickerReplace = null;
    this._entityManualListSearch = '';
  }

  private toggleEntityAddPicker(blockIdx: number, actionIdx: number): void {
    const k = this.entityAddPickerKey(blockIdx, actionIdx);
    if (this._entityAddPickerOpenKey === k) {
      this.closeEntityAddPicker();
      return;
    }
    this._entityPickerReplace = null;
    this._entityManualListSearch = '';
    this._entityAddPickerOpenKey = k;
  }

  private openEntityReplacePicker(blockIdx: number, actionIdx: number, oldEntityId: string) {
    this._entityAddPickerOpenKey = null;
    this._entityManualListSearch = '';
    this._entityPickerReplace = { blockIdx, actionIdx, oldEntityId };
  }

  private entityReplacePanelActive(blockIdx: number, actionIdx: number): boolean {
    const r = this._entityPickerReplace;
    return Boolean(r && r.blockIdx === blockIdx && r.actionIdx === actionIdx);
  }

  private visualRemoveEntityAt(actionIndex: number, entityId: string) {
    this.visualRemoveEntityChip(entityId, actionIndex);
  }

  private visualSetPresetModeAt(actionIndex: number, mode: string) {
    this.visualSelectAction(actionIndex);
    this.visualSetPresetMode(mode);
  }

  private renderActionWizardOverlay() {
    if (!this._actionWizardOpen || !this.hass || !this._visualEdit) {
      return html``;
    }

    const hass = this.hass;
    const step = this._actionWizardStep;
    const qRaw = this._actionWizardSearch.trim().toLowerCase();
    const domainF = this._actionWizardDomain;
    const svcPick = this._actionWizardServiceShort;
    const entityPick = this._actionWizardEntityId;

    const matches = (text: string) =>
      !qRaw || text.toLowerCase().includes(qRaw);

    let body = html``;

    if (step === 'domain') {
      const domains = listSelectableDomains(hass).filter(
        (d) => matches(domainLabel(hass, d)) || matches(d)
      );
      body =
        domains.length === 0
          ? html`<p class="sm-ap-empty">${msg(hass, 'card.wizard_no_results')}</p>`
          : html`<div class="sm-ap-scroll">
              ${domains.map(
                (d) => html`
                  <button
                    type="button"
                    class="sm-ap-row"
                    @click=${() => this.actionWizardPickDomain(d)}
                  >
                    <ha-icon class="sm-ap-row-icon" .icon=${domainIcon(d)}></ha-icon>
                    <div class="sm-ap-row-text">
                      <span class="sm-ap-row-primary">${domainLabel(hass, d)}</span>
                      <span class="sm-ap-row-secondary">${d}</span>
                    </div>
                    <span class="sm-ap-chevron" aria-hidden="true">›</span>
                  </button>
                `
              )}
            </div>`;
    } else if (step === 'service' && domainF) {
      const dom = domainF;
      const svcList = servicesForDomain(hass, dom).filter(
        (s) =>
          matches(s) ||
          matches(servicePrimaryLabel(hass, dom, s)) ||
          matches(serviceSecondaryHint(dom, s))
      );
      body =
        svcList.length === 0
          ? html`<p class="sm-ap-empty">${msg(hass, 'card.wizard_no_services_domain')}</p>`
          : html`<div class="sm-ap-scroll">
              ${svcList.map(
                (s) => html`
                  <button
                    type="button"
                    class="sm-ap-row sm-ap-row--dense"
                    @click=${() => this.actionWizardPickService(s)}
                  >
                    <ha-icon class="sm-ap-row-icon" .icon=${domainIcon(dom)}></ha-icon>
                    <div class="sm-ap-row-text">
                      <span class="sm-ap-row-primary">${servicePrimaryLabel(hass, dom, s)}</span>
                      <span class="sm-ap-row-secondary">${serviceSecondaryHint(dom, s)}</span>
                    </div>
                    <span class="sm-ap-chevron" aria-hidden="true">›</span>
                  </button>
                `
              )}
            </div>`;
    } else if (step === 'entity' && domainF && svcPick) {
      const actionFull = `${domainF}.${svcPick}`;
      let entities = listEntitiesInDomain(hass, domainF).filter(
        (eid) =>
          matches(friendlyEntityName(hass, eid)) || matches(eid)
      );
      entities = entities.filter((eid) =>
        entityCompatibleWithAction(eid, actionFull, hass)
      );
      body =
        entities.length === 0
          ? html`<p class="sm-ap-empty">
              ${msg(hass, 'card.wizard_no_entities', { action: actionFull })}
            </p>`
          : html`<div class="sm-ap-scroll">
              ${entities.map(
                (eid) => html`
                  <button
                    type="button"
                    class="sm-ap-row"
                    @click=${() => this.actionWizardPickEntity(eid)}
                  >
                    <ha-icon
                      class="sm-ap-row-icon"
                      .icon=${entityIcon(hass, eid) ?? domainIcon(domainF)}
                    ></ha-icon>
                    <div class="sm-ap-row-text">
                      <span class="sm-ap-row-primary">${friendlyEntityName(hass, eid)}</span>
                      <span class="sm-ap-row-secondary">${eid}</span>
                    </div>
                    <span class="sm-ap-chevron" aria-hidden="true">›</span>
                  </button>
                `
              )}
            </div>`;
    } else if (step === 'climate_preset' && entityPick) {
      const modes = this.climatePresetModesForEntityId(entityPick) ?? [];
      const filtered = modes.filter((m) => matches(m));
      body =
        filtered.length === 0
          ? html`<p class="sm-ap-empty">
              ${msg(hass, 'card.wizard_no_presets')}
            </p>`
          : html`<div class="sm-ap-scroll">
              ${filtered.map(
                (mode) => html`
                  <button
                    type="button"
                    class="sm-ap-row"
                    @click=${() => this.actionWizardApplyClimatePreset(mode)}
                  >
                    <ha-icon
                      class="sm-ap-row-icon"
                      .icon=${entityIcon(hass, entityPick) ?? domainIcon('climate')}
                    ></ha-icon>
                    <div class="sm-ap-row-text">
                      <span class="sm-ap-row-primary">${mode}</span>
                      <span class="sm-ap-row-secondary">${msg(hass, 'card.wizard_preset_sub')}</span>
                    </div>
                    <span class="sm-ap-chevron" aria-hidden="true">›</span>
                  </button>
                `
              )}
            </div>`;
    }

    const context =
      step === 'domain'
        ? msg(hass, 'card.wizard_step1')
        : step === 'service' && domainF
          ? html`${msg(hass, 'card.wizard_step2')}
              <strong>${domainLabel(hass, domainF)}</strong>${msg(hass, 'card.wizard_step2_suffix')}`
          : step === 'entity' && domainF && svcPick
            ? html`${msg(hass, 'card.wizard_step3')}
                <code>${domainF}.${svcPick}</code>${msg(hass, 'card.wizard_step3_suffix')}`
            : step === 'climate_preset' && entityPick
              ? msg(hass, 'card.wizard_step4', {
                  name: friendlyEntityName(hass, entityPick),
                })
              : '';

    return html`
      <div
        class="sm-action-wizard-overlay"
        tabindex="-1"
        @keydown=${this._onWizardOverlayKeydown}
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) {
            this.closeActionWizard();
          }
        }}
      >
        <div
          class="sm-action-wizard-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sm-ap-heading"
          @click=${(e: Event) => e.stopPropagation()}
        >
          <div class="sm-action-wizard-head">
            <button
              type="button"
              class="sm-ap-nav-btn"
              aria-label=${msg(hass, 'card.wizard_back')}
              ?disabled=${step === 'domain'}
              @click=${() => this.actionWizardBack()}
            >
              ‹
            </button>
            <h3 id="sm-ap-heading" class="sm-ap-heading">${msg(hass, 'card.wizard_title')}</h3>
            <button
              type="button"
              class="sm-ap-nav-btn"
              aria-label=${msg(hass, 'card.wizard_close')}
              @click=${() => this.closeActionWizard()}
            >
              ×
            </button>
          </div>
          <p class="sm-ap-context">${context}</p>
          <input
            type="search"
            class="sm-ap-search"
            placeholder=${msg(hass, 'card.wizard_search_placeholder')}
            aria-label=${msg(hass, 'card.wizard_search_aria')}
            .value=${this._actionWizardSearch}
            @input=${this._onWizardSearchInput}
          />
          ${body}
        </div>
      </div>
    `;
  }

  private renderActionPlanningControls(selected: TimeBlock) {
    if (!this.hass || !this._visualEdit) {
      return html``;
    }
    const hass = this.hass;

    if (this.isSinglePlaceholderAction(selected)) {
      return html`
        <div class="sm-action-entry">
          <button
            type="button"
            class="sm-action-primary-btn"
            @click=${() => this.openActionWizardAt(0)}
          >
            ${msg(hass, 'card.choose_action_btn')}
          </button>
        </div>
      `;
    }

    const blockIdx = this._visualEdit.selectedIndex;

    return html`
      <div class="sm-action-entry">
        <div class="sm-actions-stack" role="list" aria-label=${msg(hass, 'card.actions_list_aria')}>
          ${selected.actions.map((action, i) => {
            const primary = this.primaryEntityFromAction(action);
            const parsed = parseDomainService(action.action_type);
            const dom = primary.includes('.') ? primary.split('.')[0] ?? '' : '';
            const hasAction = Boolean(String(action.action_type ?? '').trim());
            const unknownService = Boolean(
              hasAction &&
                primary &&
                parsed &&
                dom &&
                parsed.domain === dom &&
                !servicesForDomain(hass, parsed.domain).includes(parsed.service)
            );

            return html`
              <div class="sm-action-block" role="listitem">
                <div class="sm-action-block-head">
                  <span class="sm-action-block-title">${this.formatActionTabTitle(action, i)}</span>
                  ${selected.actions.length > 1
                    ? html`
                        <button
                          type="button"
                          class="sm-action-block-remove"
                          aria-label=${msg(hass, 'card.remove_action_aria')}
                          title=${msg(hass, 'card.remove_action_title')}
                          @click=${() => this.visualRemoveAction(i)}
                        >
                          ${msg(hass, 'card.remove')}
                        </button>
                      `
                    : null}
                </div>
                ${hasAction ? this.renderActionSummary(action) : null}
                ${hasAction
                  ? html`
                      <div class="sm-action-entities-quick">
                        <span class="sm-action-entities-quick-title">${msg(hass, 'card.target_entities_title')}</span>
                        <div class="entity-chips">
                          ${entityIdsFromPayload(action.action_payload).map(
                            (eid) => html`
                              <span class="entity-chip" title=${eid}>
                                <button
                                  type="button"
                                  class="entity-chip-main"
                                  aria-label=${msg(hass, 'card.replace_entity_chip_aria', {
                                    name: friendlyEntityName(hass, eid),
                                  })}
                                  @click=${() => this.openEntityReplacePicker(blockIdx, i, eid)}
                                >
                                  <span class="entity-chip-text">
                                    <span class="entity-chip-name">${friendlyEntityName(hass, eid)}</span>
                                    <span class="entity-chip-id">${eid}</span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  class="entity-chip-remove"
                                  aria-label=${msg(hass, 'card.remove_entity_aria', {
                                    name: friendlyEntityName(hass, eid),
                                  })}
                                  @click=${(ev: Event) => {
                                    ev.stopPropagation();
                                    this.visualRemoveEntityAt(i, eid);
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            `
                          )}
                        </div>
                        ${this.entityReplacePanelActive(blockIdx, i) &&
                        this._entityPickerReplace
                          ? html`
                              <div class="sm-entity-replace-block">
                                <div class="sm-entity-add-row">
                                  <span class="sm-entity-add-heading">${msg(hass, 'card.replace_entity')}</span>
                                  <button
                                    type="button"
                                    class="sm-entity-add-dismiss"
                                    aria-label=${msg(hass, 'card.close_picker_aria')}
                                    @click=${() => this.closeEntityAddPicker()}
                                  >
                                    ${msg(hass, 'card.wizard_close')}
                                  </button>
                                </div>
                                <div class="sm-entity-picker-shell sm-entity-picker-shell--popover">
                                  ${this.renderQuickEntityPickerPanel(
                                    action,
                                    i,
                                    'replace',
                                    this._entityPickerReplace.oldEntityId
                                  )}
                                </div>
                              </div>
                            `
                          : null}
                        <div class="sm-entity-add-block">
                          <div class="sm-entity-add-row">
                            <span class="sm-entity-add-heading">${msg(hass, 'card.add_entity_heading')}</span>
                            ${this._entityAddPickerOpenKey === this.entityAddPickerKey(blockIdx, i)
                              ? html`
                                  <button
                                    type="button"
                                    class="sm-entity-add-dismiss"
                                    aria-label=${msg(hass, 'card.close_entity_picker_aria')}
                                    @click=${() => this.closeEntityAddPicker()}
                                  >
                                    ${msg(hass, 'card.wizard_close')}
                                  </button>
                                `
                              : html`
                                  <button
                                    type="button"
                                    class="sm-entity-add-plus"
                                    title=${msg(hass, 'card.add_entity_title')}
                                    aria-label=${msg(hass, 'card.add_entity_aria')}
                                    @click=${() => this.toggleEntityAddPicker(blockIdx, i)}
                                  >
                                    +
                                  </button>
                                `}
                          </div>
                          ${this._entityAddPickerOpenKey === this.entityAddPickerKey(blockIdx, i)
                            ? html`
                                <div class="sm-entity-picker-shell sm-entity-picker-shell--popover">
                                  ${this.renderQuickEntityPickerPanel(action, i, 'append')}
                                </div>
                              `
                            : null}
                        </div>
                      </div>
                    `
                  : null}
                ${this.renderClimatePresetForAction(action, i)}
                ${unknownService
                  ? html`<p class="sm-field-hint">
                      ${msg(hass, 'card.custom_action')} <code>${action.action_type}</code>
                    </p>`
                  : null}
                <button
                  type="button"
                  class="sm-action-primary-btn sm-action-block-wizard"
                  @click=${() => this.openActionWizardAt(i)}
                >
                  ${hasAction ? msg(hass, 'card.edit_action') : msg(hass, 'card.choose_action_btn')}
                </button>
              </div>
            `;
          })}
        </div>
        <button
          type="button"
          class="sm-action-add-another-btn"
          @click=${() => this.visualAddAction()}
        >
          ${msg(hass, 'card.add_another_action')}
        </button>
      </div>
    `;
  }

  private getClimatePresetModesForAction(action: BlockAction): string[] | null {
    if (!this.hass || action.action_type.trim() !== 'climate.set_preset_mode') {
      return null;
    }
    const ids = entityIdsFromPayload(action.action_payload);
    for (const id of ids) {
      if (!id.startsWith('climate.')) {
        continue;
      }
      const st = this.hass.states[id];
      if (!st) {
        continue;
      }
      const pm = st.attributes?.preset_modes;
      if (Array.isArray(pm) && pm.length > 0 && pm.every((x): x is string => typeof x === 'string')) {
        return pm;
      }
    }
    return null;
  }

  private renderClimatePresetForAction(action: BlockAction, actionIndex: number) {
    const modes = this.getClimatePresetModesForAction(action);
    if (!modes?.length) {
      return html``;
    }
    const cur = String(
      (action.action_payload as Record<string, unknown>)?.preset_mode ?? ''
    );
    const orphan = cur && !modes.includes(cur);
    return html`
      <label class="sm-form-label sm-form-label-last sm-action-climate-preset">
        ${msg(this.hass, 'card.preset_mode_label')}
        <select
          class="sm-select"
          .value=${live(cur)}
          @change=${(e: Event) =>
            this.visualSetPresetModeAt(
              actionIndex,
              (e.target as HTMLSelectElement).value
            )}
        >
          ${orphan ? html`<option value=${cur}>${cur}${msg(this.hass, 'card.preset_current_suffix')}</option>` : null}
          ${modes.map((m) => html`<option value=${m}>${m}</option>`)}
        </select>
      </label>
    `;
  }

  private async saveVisualEditor() {
    if (!this._visualEdit) {
      return;
    }
    const { scheduleId, blocks, repeatDays } = this._visualEdit;
    const hass = this.hass;
    for (const b of blocks) {
      const ok = (b.actions || []).some((a) => String(a.action_type ?? '').trim());
      if (!ok) {
        alert(msg(hass, 'card.validation_min_action'));
        return;
      }
    }
    const dupAt = findDuplicateBlockIndex(blocks);
    if (dupAt >= 0) {
      alert(msg(hass, 'card.validation_duplicate', { n: String(dupAt + 1) }));
      return;
    }
    if (hasOverlappingSameDayBlocks(blocks)) {
      alert(msg(hass, 'card.validation_overlap_day'));
      return;
    }
    try {
      await this.services().updateSchedule(scheduleId, {
        repeat_days: repeatDays,
        time_blocks: this.blocksToPayload(blocks),
      });
      this.closeVisualEditor();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      alert(`${msg(hass, 'card.save_failed_prefix')} ${errMsg}`);
      // eslint-disable-next-line no-console
      console.error('schedule_manager.update_schedule failed', e);
    }
  }

  private visualSetPresetMode(mode: string) {
    if (!this._visualEdit) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const block = this._visualEdit.blocks[sel];
    const ai = Math.min(
      this._visualEdit.selectedActionIndex,
      Math.max(0, (block?.actions?.length ?? 1) - 1)
    );
    const action = block?.actions?.[ai];
    if (!block || !action) {
      return;
    }
    const base =
      typeof action.action_payload === 'object' && action.action_payload !== null
        ? { ...(action.action_payload as Record<string, unknown>) }
        : {};
    base.preset_mode = mode;
    this.visualPatchSelectedAction({ action_payload: base });
  }

  /** Couleur affichée sur la frise : métadonnée sur la première action du créneau. */
  private hasCustomBlockColor(block: TimeBlock): boolean {
    const p = block.actions?.[0]?.action_payload;
    if (!p || typeof p !== 'object') {
      return false;
    }
    return typeof (p as Record<string, unknown>)[SCHEDULE_MANAGER_COLOR_KEY] === 'string';
  }

  private blockColorPickerHex(block: TimeBlock): string {
    const p = block.actions?.[0]?.action_payload;
    if (p && typeof p === 'object') {
      const c = (p as Record<string, unknown>)[SCHEDULE_MANAGER_COLOR_KEY];
      if (typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c.trim())) {
        return c.trim();
      }
    }
    return '#2196F3';
  }

  private visualSetBlockColor(hex: string) {
    if (!this._visualEdit) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const block = this._visualEdit.blocks[sel];
    if (!block?.actions?.length) {
      return;
    }
    const actions = block.actions.map((a, i) => {
      if (i !== 0) {
        return a;
      }
      const base =
        typeof a.action_payload === 'object' && a.action_payload !== null
          ? { ...(a.action_payload as Record<string, unknown>) }
          : {};
      base[SCHEDULE_MANAGER_COLOR_KEY] = hex;
      return { ...a, action_payload: base };
    });
    const next = { ...block, actions };
    const trial = [...this._visualEdit.blocks];
    trial[sel] = next;
    this._visualEdit = { ...this._visualEdit, blocks: trial };
  }

  private visualClearBlockColor() {
    if (!this._visualEdit) {
      return;
    }
    const sel = this._visualEdit.selectedIndex;
    const block = this._visualEdit.blocks[sel];
    if (!block?.actions?.length) {
      return;
    }
    const actions = block.actions.map((a, i) => {
      if (i !== 0) {
        return a;
      }
      const base =
        typeof a.action_payload === 'object' && a.action_payload !== null
          ? { ...(a.action_payload as Record<string, unknown>) }
          : {};
      delete base[SCHEDULE_MANAGER_COLOR_KEY];
      return { ...a, action_payload: base };
    });
    const next = { ...block, actions };
    const trial = [...this._visualEdit.blocks];
    trial[sel] = next;
    this._visualEdit = { ...this._visualEdit, blocks: trial };
  }

  private renderBlockColorControls(block: TimeBlock) {
    const hass = this.hass;
    const pickerVal = this.blockColorPickerHex(block);
    const custom = this.hasCustomBlockColor(block);
    return html`
      <div class="sm-form-label sm-color-field">
        <span class="sm-color-field-title">${msg(hass, 'card.color_field_title')}</span>
        <div class="sm-color-row">
          <label class="sm-color-system-label">
            <span class="sm-color-system-text">${msg(hass, 'card.color_browser_picker_short')}</span>
            <input
              type="color"
              class="sm-color-native"
              .value=${pickerVal}
              title=${msg(hass, 'card.color_system_title')}
              aria-label=${msg(hass, 'card.color_system_aria')}
              @input=${(e: Event) =>
                this.visualSetBlockColor((e.target as HTMLInputElement).value)}
            />
          </label>
          <div class="sm-color-presets" aria-hidden="true">
            ${BLOCK_COLOR_PRESETS.map(
              (hex) => html`
                <button
                  type="button"
                  class="sm-color-swatch"
                  style="background:${hex}"
                  title=${hex}
                  aria-label=${msg(hass, 'card.color_apply_aria', { hex })}
                  @click=${() => this.visualSetBlockColor(hex)}
                ></button>
              `
            )}
          </div>
          <button
            type="button"
            class="sm-color-reset"
            ?disabled=${!custom}
            @click=${() => this.visualClearBlockColor()}
          >
            ${msg(hass, 'card.color_default')}
          </button>
        </div>
      </div>
    `;
  }

  private renderEditorTimeline(blocks: TimeBlock[], selectedIndex: number) {
    const hass = this.hass;
    const segments = this.sortTimelineSegmentsForPaint(blocksToTimelineSegments(blocks));
    const caps = this.segmentCapIndices(segments);
    const resizeHandles = timelineResizeHandlesForSelection(blocks, selectedIndex);
    const nowPct = nowPercentOfDay();
    const nowSeg = paintOrderSegmentIndexForNowPct(segments, nowPct);
    return html`
      <div
        class="timeline-frise sm-scheduler-frise sm-editor-frise"
        role="group"
        aria-label=${msg(hass, 'card.editor_timeline_aria')}
      >
        <div class="sm-frise-heading">
          <span class="sm-frise-heading-label">${msg(hass, 'card.time_axis_label')}</span>
        </div>
        <div class="sm-scheduler-track sm-scheduler-track--editor">
          <div class="sm-scheduler-bar">
            ${segments.map((s, i) => {
              const blk = blocks[s.blockIndex];
              const fill = blk ? blockTimelineFill(blk) : `hsl(${s.hue}, 58%, 42%)`;
              const sel = s.blockIndex === selectedIndex ? 'is-selected' : '';
              const nowActive = nowSeg === i ? 'sm-slot--now-active' : '';
              const capS = caps.capStart.has(i) ? 'sm-slot--cap-start' : '';
              const capE = caps.capEnd.has(i) ? 'sm-slot--cap-end' : '';
              return html`
                <div
                  class="sm-slot ${sel} ${nowActive} ${capS} ${capE}"
                  style=${this.schedulerSlotAbsoluteStyle(s.leftPct, s.widthPct, fill, nowSeg === i)}
                  title=${s.blockIndex === selectedIndex
                    ? msg(hass, 'card.drag_move_slot', { label: s.label })
                    : s.label}
                  @pointerdown=${(e: PointerEvent) => this.onSlotPointerDown(e, s.blockIndex)}
                  @click=${(e: Event) => this.onSlotClick(e, s.blockIndex)}
                >
                  <span class="sm-slot-label">${s.label}</span>
                </div>
              `;
            })}
          </div>
          ${resizeHandles.map((h) => {
            const label =
              h.kind === 'junction'
                ? msg(hass, 'card.resize_aria_junction')
                : h.kind === 'start'
                  ? msg(hass, 'card.resize_aria_start')
                  : msg(hass, 'card.resize_aria_end');
            const title =
              h.kind === 'junction'
                ? msg(hass, 'card.resize_title_junction')
                : h.kind === 'start'
                  ? msg(hass, 'card.resize_title_start')
                  : msg(hass, 'card.resize_title_end');
            return html`
              <button
                type="button"
                class="sm-scheduler-handle"
                style=${styleMap({
                  left: `${h.pct}%`,
                  transform: 'translateX(-50%)',
                })}
                aria-label=${label}
                title=${title}
                @pointerdown=${(e: PointerEvent) => this.onResizePointerDown(e, h)}
              >
                <span class="sm-scheduler-handle-grip"></span>
              </button>
            `;
          })}
        </div>
        ${this.renderSchedulerTimeScale('editor')}
      </div>
    `;
  }

  private renderVisualEditorOverlay() {
    const v = this._visualEdit;
    if (!v || !this.hass) {
      return html``;
    }
    const schedulesMap = this.getSchedulesRecord();
    const raw = schedulesMap[v.scheduleId];
    if (!raw) {
      return html``;
    }
    const schedule = this.withCanonicalId(v.scheduleId, raw);
    const blocks = v.blocks;
    const sel = v.selectedIndex;
    const selected = blocks[sel];

    const hass = this.hass;
    return html`
      <div
        class="sm-overlay"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) {
            this.closeVisualEditor();
          }
        }}
      >
        <div
        class="sm-modal"
        tabindex="-1"
        @click=${(e: Event) => e.stopPropagation()}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.closeVisualEditor();
          }
        }}
        >
          <div class="sm-modal-head">
            <h2>${schedule.name}</h2>
            <button
              type="button"
              class="sm-icon-btn"
              aria-label=${msg(hass, 'card.close_overlay_aria')}
              @click=${() => this.closeVisualEditor()}
            >
              ${msg(hass, 'card.modal_close')}
            </button>
          </div>
          <div class="sm-modal-sub">
            <span>${msg(hass, 'card.repeat_days')}</span>
            <div class="sm-repeat-days">
              ${[0, 1, 2, 3, 4, 5, 6].map(
                (day) => html`
                  <button
                    type="button"
                    class="sm-day ${v.repeatDays.includes(day) ? 'on' : ''}"
                    @click=${() => this.visualToggleDay(day)}
                  >
                    ${weekdayShort(hass, day)}
                  </button>
                `
              )}
            </div>
          </div>
          <div class="sm-toolbar">
            <button type="button" class="sm-tool-btn sm-tool-accent" @click=${() => this.visualAddBlock()}>
              ${msg(hass, 'card.add_slot')}
            </button>
            <button
              type="button"
              class="sm-tool-btn danger"
              ?disabled=${blocks.length === 0}
              @click=${() => this.visualRemoveSelected()}
            >
              ${msg(hass, 'card.remove_slot')}
            </button>
          </div>
          ${this.renderEditorTimeline(blocks, sel)}
          ${blocks.length === 0
            ? html`
                <div class="sm-modal-body sm-modal-body-frise-placeholder">
                  <div class="empty-hint">
                    ${msg(hass, 'card.no_slots_editor')}
                  </div>
                </div>
              `
            : null}
          ${selected
            ? html`
                <div class="sm-modal-body">
                  <div class="sm-time-row">
                    <label>
                      ${msg(hass, 'card.start_time_label')}
                      <input
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        maxlength="8"
                        .value=${haTimeToHHMM(selected.start_time)}
                        @input=${(e: Event) =>
                          this.visualPatchBlockFields({
                            start_time: normalizeTimeForHa(
                              (e.target as HTMLInputElement).value
                            ),
                          })}
                      />
                    </label>
                    <label>
                      ${msg(hass, 'card.end_time_label')}
                      <input
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        maxlength="8"
                        .value=${haTimeToHHMM(selected.end_time)}
                        @input=${(e: Event) =>
                          this.visualPatchBlockFields({
                            end_time: normalizeTimeForHa(
                              (e.target as HTMLInputElement).value
                            ),
                          })}
                      />
                    </label>
                  </div>
                  ${this.renderBlockColorControls(selected)}
                  <div class="sm-action-card">
                    <h4>${msg(hass, 'card.actions_during_slot')}</h4>
                    ${this.renderActionPlanningControls(selected)}
                  </div>
                </div>
              `
            : null}
          <div class="sm-modal-footer">
            <button type="button" class="btn-text danger" @click=${() => this.closeVisualEditor()}>
              ${msg(hass, 'card.cancel')}
            </button>
            <button type="button" class="btn-text primary" @click=${() => this.saveVisualEditor()}>
              ${msg(hass, 'card.save')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private async createScheduleFromInput() {
    const name = this._newScheduleName.trim();
    if (!name || this._creating) {
      return;
    }
    this._creating = true;
    try {
      await this.services().createSchedule(name);
      this._newScheduleName = '';
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('schedule_manager.create_schedule failed', e);
    } finally {
      this._creating = false;
    }
  }

  setConfig(config: CardConfig) {
    if (!config.type) {
      throw new Error('Type must be defined');
    }
    // Nouvelle référence : aperçu + mises à jour quand HA rappelle setConfig avec le même objet.
    this.config = { ...config, type: config.type } as CardConfig;
    this.requestUpdate();
  }

  getCardSize() {
    /* 1 = hauteur suivant le contenu ; une valeur > 1 réserve des rangées vides sous la carte (sections / masonry). */
    return 1;
  }

  getGridOptions() {
    return { rows: 'auto' as const };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-manager-card': ScheduleManagerCard;
  }
}

const w = window as any;
w.customCards = w.customCards || [];
w.customCards.push({
  type: 'schedule-manager-card',
  name: 'Schedule Manager',
  description: 'Planning Schedule Manager',
});
