import { newEmptyAction } from './block-model';
import type { BlockAction, TimeBlock } from './types';

export const MINUTES_PER_DAY = 24 * 60;

/**
 * Dernière heure acceptée par Home Assistant `cv.time` (pas de 24:00:00 dans les services).
 * Utilisée pour fin de journée / drag maximal.
 */
export const HA_END_OF_DAY_TIME = '23:59:59';

/** Aligné sur l’usage du scheduler-card (pas de 15 min pour le drag des séparateurs). */
export const TIMELINE_DRAG_SNAP_MINUTES = 15;

export function snapMinutesToGrid(totalMinutes: number, stepMinutes: number): number {
  if (stepMinutes <= 1) {
    return Math.round(totalMinutes);
  }
  return Math.round(totalMinutes / stepMinutes) * stepMinutes;
}

/** Graduations par défaut (vue dashboard / repli éditeur). */
export interface TimelineScaleTick {
  pct: number;
  label: string;
  align: 'start' | 'center' | 'end';
}

export const DEFAULT_TIMELINE_SCALE_TICKS: TimelineScaleTick[] = [
  { pct: 0, label: '00:00', align: 'start' },
  { pct: 25, label: '06:00', align: 'center' },
  { pct: 50, label: '12:00', align: 'center' },
  { pct: 75, label: '18:00', align: 'center' },
  { pct: 100, label: '24:00', align: 'end' },
];

/**
 * Heures affichées sous la frise selon la largeur (même logique que scheduler-card :
 * éviter les étiquettes trop serrées sur petit écran).
 */
export function timelineScaleTicksForWidth(widthPx: number): TimelineScaleTick[] {
  if (!widthPx || widthPx < 120) {
    return DEFAULT_TIMELINE_SCALE_TICKS;
  }

  const allowedStepHours = [1, 2, 3, 4, 6, 8, 12];
  const targetPxPerHour = 100;
  let stepH = Math.ceil(24 / (widthPx / targetPxPerHour));
  if (stepH < 1) {
    stepH = 1;
  }
  while (stepH <= 24 && !allowedStepHours.includes(stepH)) {
    stepH++;
  }
  if (stepH > 12) {
    stepH = 12;
  }

  const inner = Math.max(0, Math.floor(24 / stepH) - 1);
  const nums = [
    0,
    ...Array.from({ length: inner }, (_, i) => (i + 1) * stepH),
    24,
  ];
  const uniq = [...new Set(nums)].sort((a, b) => a - b);

  return uniq.map((h, i) => ({
    pct: (h / 24) * 100,
    label: h === 24 ? '24:00' : `${String(h).padStart(2, '0')}:00`,
    align:
      i === 0 ? 'start' : i === uniq.length - 1 ? 'end' : ('center' as const),
  }));
}

/** Métadonnée carte uniquement — à retirer si le payload est passé tel quel à un service HA. */
export const SCHEDULE_MANAGER_COLOR_KEY = 'schedule_manager_color';

export interface TimelineSegment {
  /** Position gauche en % (0–100) */
  leftPct: number;
  /** Largeur en % */
  widthPct: number;
  label: string;
  /** Teinte CSS (0–360) pour hsl */
  hue: number;
  /** Index de la plage dans `time_blocks` (identique pour les 2 segments si passage minuit). */
  blockIndex: number;
}

function parseToMinutes(t: string): number {
  const parts = String(t).split(':').map((p) => Number(p));
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return h * 60 + m + s / 60;
}

/** Exposé pour le drag de plage / tests (même moteur que la frise). */
export function timeStringToMinutes(t: string): number {
  return parseToMinutes(t);
}

function segmentLabelOne(action: BlockAction): string {
  if (!String(action.action_type ?? '').trim()) {
    return '—';
  }
  const p = action.action_payload;
  if (p && typeof p === 'object') {
    const rec = p as Record<string, unknown>;
    if (rec.preset_mode !== undefined) {
      return String(rec.preset_mode);
    }
    if (rec.hvac_mode !== undefined) {
      return String(rec.hvac_mode);
    }
    if (rec.position !== undefined) {
      return `${String(rec.position)}%`;
    }
  }
  const segs = action.action_type.split('.');
  const tail = action.action_type.includes('.')
    ? segs[segs.length - 1] ?? action.action_type
    : action.action_type;
  return tail.length > 14 ? `${tail.slice(0, 12)}…` : tail;
}

export function segmentLabel(block: TimeBlock): string {
  const actions = block.actions || [];
  const configured = actions.filter((a) => String(a.action_type ?? '').trim());
  if (configured.length === 0) {
    return '—';
  }
  const labels = configured.map((a) => segmentLabelOne(a));
  if (labels.length === 1) {
    return labels[0] ?? '—';
  }
  const first = labels[0] ?? '—';
  const suffix = ` +${labels.length - 1}`;
  const maxMain = Math.max(4, 14 - suffix.length);
  if (first.length > maxMain) {
    return `${first.slice(0, maxMain)}…${suffix}`;
  }
  return `${first}${suffix}`;
}

function hueFromLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) % 360;
  }
  return h;
}

/** Même teinte que les segments de la frise (pastilles liste / barres). */
export function hueForBlock(block: TimeBlock): number {
  const label = segmentLabel(block);
  const key = (block.actions || [])
    .map((a) => a.action_type)
    .filter(Boolean)
    .join(',');
  return hueFromLabel(`${label}-${key}`);
}

/** Couleur de remplissage segment (#hex ou hsl dérivé du bloc). */
export function blockTimelineFill(block: TimeBlock): string {
  for (const a of block.actions || []) {
    const p = a.action_payload;
    if (p && typeof p === 'object') {
      const raw = (p as Record<string, unknown>)[SCHEDULE_MANAGER_COLOR_KEY];
      if (typeof raw === 'string') {
        const c = raw.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(c)) {
          return c;
        }
        if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
          const h = c.slice(1);
          return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
        }
      }
    }
  }
  return `hsl(${hueForBlock(block)}, 58%, 42%)`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function parseHexRgb(input: string): { r: number; g: number; b: number } | null {
  const t = input.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) {
    return {
      r: parseInt(t.slice(1, 3), 16),
      g: parseInt(t.slice(3, 5), 16),
      b: parseInt(t.slice(5, 7), 16),
    };
  }
  if (/^#[0-9A-Fa-f]{3}$/i.test(t)) {
    const h = t.slice(1);
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = ((max + min) / 2) * 100;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > 50 ? (d / (2 - max - min)) * 100 : (d / (max + min)) * 100;
  let hh = 0;
  switch (max) {
    case rn:
      hh = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      break;
    case gn:
      hh = ((bn - rn) / d + 2) / 6;
      break;
    default:
      hh = ((rn - gn) / d + 4) / 6;
      break;
  }
  return { h: hh * 360, s, l };
}

function fillToHsl(fill: string): { h: number; s: number; l: number } {
  const t = fill.trim();
  const m = t.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
  if (m) {
    return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
  }
  const rgb = parseHexRgb(t);
  if (rgb) {
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
  }
  return { h: 210, s: 58, l: 42 };
}

/**
 * Variables CSS pour le double cadre « créneau actif » : même teinte que le fond, plus saturée / contrastée.
 */
export function nowActiveRingCssVars(fill: string): Record<string, string> {
  const { h, s, l } = fillToHsl(fill);
  const light = l > 62;
  let innerS: number;
  let innerL: number;
  let outerS: number;
  let outerL: number;
  if (light) {
    innerS = clamp(s + 28, 72, 100);
    innerL = clamp(l - 6, 36, 62);
    outerS = clamp(s + 14, 52, 100);
    outerL = clamp(l - 30, 12, 44);
  } else {
    innerS = clamp(s + 22, 62, 100);
    innerL = clamp(l + 14 + (l < 34 ? 16 : 0), 46, 88);
    outerS = clamp(s + 10, 48, 100);
    outerL = clamp(l - 20, 8, 38);
  }
  return {
    '--sm-slot-now-ring-1': `hsl(${round1(h)}, ${round1(innerS)}%, ${round1(innerL)}%)`,
    '--sm-slot-now-ring-2': `hsl(${round1(h)}, ${round1(outerS)}%, ${round1(outerL)}%)`,
  };
}

/**
 * Découpe les plages en segments sur une journée (0:00–24:00), gère le passage minuit.
 */
export function blocksToTimelineSegments(blocks: TimeBlock[]): TimelineSegment[] {
  const out: TimelineSegment[] = [];
  const day = MINUTES_PER_DAY;

  const list = blocks || [];
  for (let bi = 0; bi < list.length; bi++) {
    const b = list[bi];
    const start = parseToMinutes(b.start_time);
    const end = parseToMinutes(b.end_time);
    const label = segmentLabel(b);
    const hue = hueForBlock(b);

    if (end > start) {
      const w = end - start;
      out.push({
        leftPct: (start / day) * 100,
        widthPct: (w / day) * 100,
        label,
        hue,
        blockIndex: bi,
      });
    } else if (end < start) {
      const w1 = day - start;
      const w2 = end;
      out.push({
        leftPct: (start / day) * 100,
        widthPct: (w1 / day) * 100,
        label,
        hue,
        blockIndex: bi,
      });
      out.push({
        leftPct: 0,
        widthPct: (w2 / day) * 100,
        label,
        hue,
        blockIndex: bi,
      });
    }
  }

  return out;
}

export function nowPercentOfDay(): number {
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  return (m / MINUTES_PER_DAY) * 100;
}

/**
 * Index du segment (dans l’ordre d’affichage après `sortTimelineSegmentsForPaint`) qui contient
 * l’instant courant, en minutes sur la journée. En cas de chevauchement, le dernier index gagne
 * (plage la plus étroite au-dessus, comme la peinture).
 */
export function paintOrderSegmentIndexForNowPct(
  segmentsPaintOrder: TimelineSegment[],
  nowPct: number
): number | null {
  if (!segmentsPaintOrder.length) {
    return null;
  }
  const nowMin = (nowPct / 100) * MINUTES_PER_DAY;
  const eps = 1e-4;
  let last: number | null = null;
  for (let i = 0; i < segmentsPaintOrder.length; i++) {
    const s = segmentsPaintOrder[i];
    const startMin = (s.leftPct / 100) * MINUTES_PER_DAY;
    const endMin = ((s.leftPct + s.widthPct) / 100) * MINUTES_PER_DAY;
    if (nowMin + eps >= startMin && nowMin < endMin - eps) {
      last = i;
    }
  }
  return last;
}

export function minutesToHaTime(totalMinutes: number): string {
  let m = Math.round(totalMinutes) % MINUTES_PER_DAY;
  if (m < 0) {
    m += MINUTES_PER_DAY;
  }
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

/** Pour le drag sur la frise : minute ≥ fin de journée → `HA_END_OF_DAY_TIME` (pas 24:00:00). */
export function minuteToHaTimeForSchedule(totalMinutes: number): string {
  const r = Math.round(totalMinutes);
  if (r >= MINUTES_PER_DAY) {
    return HA_END_OF_DAY_TIME;
  }
  if (r <= 0) {
    return '00:00:00';
  }
  const h = Math.floor(r / 60);
  const mm = r % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

export function isOvernightBlock(b: TimeBlock): boolean {
  const s = parseToMinutes(b.start_time);
  const e = parseToMinutes(b.end_time);
  return e < s;
}

/** Intervalle [start, end) en minutes sur une même journée (pas de passage minuit). */
export function sameDayBlockIntervalExclusiveEnd(
  b: TimeBlock
): { start: number; end: number } | null {
  if (isOvernightBlock(b)) {
    return null;
  }
  const s = Math.round(parseToMinutes(b.start_time));
  const e = Math.round(parseToMinutes(b.end_time));
  if (e <= s) {
    return null;
  }
  return { start: s, end: e };
}

/**
 * Détecte un chevauchement entre plages « même jour » (intervalles [début, fin) en minutes).
 * Utilisé pour empêcher deux créneaux actifs au même moment.
 */
export function hasOverlappingSameDayBlocks(blocks: TimeBlock[]): boolean {
  const intervals: { start: number; end: number }[] = [];
  for (const b of blocks || []) {
    const iv = sameDayBlockIntervalExclusiveEnd(b);
    if (iv) {
      intervals.push(iv);
    }
  }
  intervals.sort((a, b) => a.start - b.start);
  for (let i = 0; i < intervals.length - 1; i++) {
    if (intervals[i].end > intervals[i + 1].start) {
      return true;
    }
  }
  return false;
}

/** Trouve un créneau libre d’au moins `minDurationMinutes` minutes pour une nouvelle plage. */
export function suggestGapIntervalMinutes(
  blocks: TimeBlock[],
  minDurationMinutes = 60
): { start: number; end: number } | null {
  const minDur = Math.max(TIMELINE_DRAG_SNAP_MINUTES, minDurationMinutes);
  const intervals: { start: number; end: number }[] = [];
  for (const b of blocks || []) {
    const iv = sameDayBlockIntervalExclusiveEnd(b);
    if (iv) {
      intervals.push(iv);
    }
  }
  intervals.sort((a, b) => a.start - b.start);
  let prevEnd = 0;
  for (const iv of intervals) {
    if (iv.start - prevEnd >= minDur) {
      return { start: prevEnd, end: prevEnd + minDur };
    }
    prevEnd = Math.max(prevEnd, iv.end);
  }
  if (MINUTES_PER_DAY - prevEnd >= minDur) {
    return { start: prevEnd, end: prevEnd + minDur };
  }
  if (minDur > TIMELINE_DRAG_SNAP_MINUTES) {
    return suggestGapIntervalMinutes(blocks, TIMELINE_DRAG_SNAP_MINUTES);
  }
  return null;
}

/**
 * Journée déjà couverte sans trou utilisable : insère une plage en tête [0, slotM)
 * soit en décalant le début de la première plage « même jour » qui commence à minuit,
 * soit si la première plage commence plus tard avec un trou ≥ slot avant elle.
 */
export function tryInsertSlotAtDayStart(
  blocks: TimeBlock[],
  slotMinutes = TIMELINE_DRAG_SNAP_MINUTES
): TimeBlock[] | null {
  const slot = Math.max(1, Math.round(slotMinutes));
  const list = blocks || [];

  const indexed = list
    .map((b, i) => ({ i, b, iv: sameDayBlockIntervalExclusiveEnd(b) }))
    .filter(
      (x): x is { i: number; b: TimeBlock; iv: { start: number; end: number } } =>
        x.iv !== null
    )
    .sort((a, b) => a.iv.start - b.iv.start || a.iv.end - b.iv.end);

  if (!indexed.length) {
    return null;
  }

  const first = indexed[0];
  const newBlock = (): TimeBlock => ({
    start_time: '00:00:00',
    end_time: minuteToHaTimeForSchedule(slot),
    actions: [newEmptyAction()],
  });

  if (first.iv.start >= slot) {
    const withNew = [newBlock(), ...list];
    return hasOverlappingSameDayBlocks(withNew) ? null : withNew;
  }

  if (first.iv.start === 0 && first.iv.end - first.iv.start > slot) {
    const trimmed: TimeBlock = {
      ...first.b,
      start_time: minuteToHaTimeForSchedule(slot),
    };
    const mapped = list.map((b, j) => (j === first.i ? trimmed : b));
    const withNew = [newBlock(), ...mapped];
    return hasOverlappingSameDayBlocks(withNew) ? null : withNew;
  }

  return null;
}

/**
 * Indices des plages « même jour » (autres que `excludeIndex`) dont l’intervalle [s,e)
 * intersecte [startM, endM) (demi-ouvert).
 */
export function blockIndicesOverlappingIntervalSameDay(
  blocks: TimeBlock[],
  excludeIndex: number,
  startM: number,
  endM: number
): number[] {
  const out: number[] = [];
  for (let i = 0; i < (blocks || []).length; i++) {
    if (i === excludeIndex) {
      continue;
    }
    const iv = sameDayBlockIntervalExclusiveEnd(blocks[i]);
    if (!iv) {
      continue;
    }
    if (iv.start < endM && iv.end > startM) {
      out.push(i);
    }
  }
  return out;
}

/**
 * Applique le déplacement d’une plage ; si cela crée un chevauchement avec **une seule** autre plage,
 * échange les créneaux horaires (l’autre prend l’ancien créneau de la plage déplacée).
 * Sinon retourne `null` (mouvement refusé).
 */
export function applyDragMoveWithOptionalSwap(
  blocks: TimeBlock[],
  dragIdx: number,
  newStartM: number,
  newEndM: number,
  origStartM: number,
  origEndM: number
): TimeBlock[] | null {
  const list = blocks || [];
  if (newEndM <= newStartM || origEndM <= origStartM) {
    return null;
  }
  const cur = list[dragIdx];
  if (!cur || isOvernightBlock(cur)) {
    return null;
  }

  const moved: TimeBlock = {
    ...cur,
    start_time: minuteToHaTimeForSchedule(newStartM),
    end_time: minuteToHaTimeForSchedule(newEndM),
  };

  const trial = list.map((b, i) => (i === dragIdx ? moved : b));
  if (!hasOverlappingSameDayBlocks(trial)) {
    return trial;
  }

  const overlaps = blockIndicesOverlappingIntervalSameDay(trial, dragIdx, newStartM, newEndM);
  if (overlaps.length !== 1) {
    return null;
  }
  const j = overlaps[0];
  const other = list[j];
  if (!other || isOvernightBlock(other)) {
    return null;
  }

  const swapped = list.map((b, i) => {
    if (i === dragIdx) {
      return moved;
    }
    if (i === j) {
      return {
        ...other,
        start_time: minuteToHaTimeForSchedule(origStartM),
        end_time: minuteToHaTimeForSchedule(origEndM),
      };
    }
    return b;
  });

  return hasOverlappingSameDayBlocks(swapped) ? null : swapped;
}

/** Frontière draggable entre deux plages consécutives sur la frise (sans passage minuit). */
export interface TouchBoundary {
  /** Position du séparateur en % (0–100). */
  pct: number;
  leftBlockIndex: number;
  rightBlockIndex: number;
  minMinute: number;
  maxMinute: number;
}

export function touchBoundariesBetweenBlocks(blocks: TimeBlock[]): TouchBoundary[] {
  const list = blocks || [];
  const segments = blocksToTimelineSegments(list);
  if (segments.length < 2) {
    return [];
  }
  const sorted = [...segments].sort((a, b) => a.leftPct - b.leftPct);
  const eps = 0.12;
  const out: TouchBoundary[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const endA = a.leftPct + a.widthPct;
    if (Math.abs(endA - b.leftPct) > eps) {
      continue;
    }
    if (a.blockIndex === b.blockIndex) {
      continue;
    }
    const L = list[a.blockIndex];
    const R = list[b.blockIndex];
    if (!L || !R || isOvernightBlock(L) || isOvernightBlock(R)) {
      continue;
    }
    const minM = Math.floor(parseToMinutes(L.start_time)) + 1;
    const maxM = Math.ceil(parseToMinutes(R.end_time)) - 1;
    if (minM >= maxM) {
      continue;
    }
    const boundaryMin = Math.round(
      (parseToMinutes(L.end_time) + parseToMinutes(R.start_time)) / 2
    );
    const pct = (boundaryMin / MINUTES_PER_DAY) * 100;
    out.push({
      pct,
      leftBlockIndex: a.blockIndex,
      rightBlockIndex: b.blockIndex,
      minMinute: minM,
      maxMinute: maxM,
    });
  }

  return out;
}

/** Poignée unique sur la frise : jonction entre deux plages ou bord début/fin d’une plage. */
export type TimelineResizeHandle =
  | {
      kind: 'junction';
      pct: number;
      leftBlockIndex: number;
      rightBlockIndex: number;
      minMinute: number;
      maxMinute: number;
    }
  | {
      kind: 'start';
      pct: number;
      blockIndex: number;
      minMinute: number;
      maxMinute: number;
    }
  | {
      kind: 'end';
      pct: number;
      blockIndex: number;
      minMinute: number;
      maxMinute: number;
    };

/**
 * Toutes les poignées redimensionnement : jonctions entre blocs adjacents + début/fin libres.
 * Sans cela, une seule plage ou des plages séparées par un trou n’avaient aucune poignée.
 */
export function allTimelineResizeHandles(blocks: TimeBlock[]): TimelineResizeHandle[] {
  const list = blocks || [];
  const internals = touchBoundariesBetweenBlocks(list);
  const junctionMinutes = new Set<number>();
  for (const tb of internals) {
    const L = list[tb.leftBlockIndex];
    if (L) {
      junctionMinutes.add(Math.round(parseToMinutes(L.end_time)));
    }
  }

  const out: TimelineResizeHandle[] = internals.map((tb) => ({
    kind: 'junction' as const,
    pct: tb.pct,
    leftBlockIndex: tb.leftBlockIndex,
    rightBlockIndex: tb.rightBlockIndex,
    minMinute: tb.minMinute,
    maxMinute: tb.maxMinute,
  }));

  const gap = TIMELINE_DRAG_SNAP_MINUTES;

  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (isOvernightBlock(b)) {
      continue;
    }

    const sm = Math.round(parseToMinutes(b.start_time));
    const em = Math.round(parseToMinutes(b.end_time));

    if (!junctionMinutes.has(sm)) {
      const maxStart = em - gap;
      if (maxStart >= 0 && sm <= maxStart) {
        out.push({
          kind: 'start',
          pct: (sm / MINUTES_PER_DAY) * 100,
          blockIndex: i,
          minMinute: 0,
          maxMinute: maxStart,
        });
      }
    }

    if (!junctionMinutes.has(em)) {
      const minEnd = sm + gap;
      if (minEnd <= MINUTES_PER_DAY) {
        out.push({
          kind: 'end',
          pct: Math.min(100, (em / MINUTES_PER_DAY) * 100),
          blockIndex: i,
          minMinute: minEnd,
          maxMinute: MINUTES_PER_DAY,
        });
      }
    }
  }

  out.sort((a, b) => a.pct - b.pct);
  return out;
}

/** Poignées uniquement pour la plage sélectionnée (on ne redimensionne pas les autres). */
export function timelineResizeHandlesForSelection(
  blocks: TimeBlock[],
  selectedIndex: number
): TimelineResizeHandle[] {
  return allTimelineResizeHandles(blocks).filter((h) => {
    if (h.kind === 'junction') {
      return h.leftBlockIndex === selectedIndex || h.rightBlockIndex === selectedIndex;
    }
    return h.blockIndex === selectedIndex;
  });
}
