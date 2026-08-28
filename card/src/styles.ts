import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    /* Sections / grille : ne pas s'étirer sur la hauteur de la ligne (évite le grand vide sous le contenu). */
    align-self: start;
    height: fit-content;
    min-height: 0;
  }

  .card {
    padding: 16px 16px 12px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    height: fit-content;
    min-height: 0;
  }

  /** Titre de la carte (sous ha-card) : taille réduite par rapport au défaut Lovelace. */
  .card-header {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: 0.01em;
    color: var(--primary-text-color);
    margin: 0 0 4px;
  }

  .schedule {
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--divider-color);
  }

  .schedule:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  /** Mode sans lien (show_slots_on_card désactivé) : zone planning cliquable sauf contrôles. */
  .schedule--tap-opens-editor {
    cursor: pointer;
    border-radius: 10px;
    outline: none;
    transition: background 0.15s ease;
  }

  .schedule--tap-opens-editor:hover {
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.06);
  }

  .schedule--tap-opens-editor:focus-visible {
    box-shadow: 0 0 0 2px var(--primary-color);
  }

  .compact-empty-hint {
    margin-bottom: 0;
  }

  .schedule-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .schedule-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sm-schedule-repeat-days {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin: 0 0 10px;
  }

  .sm-schedule-repeat-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.25rem;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.2;
    border: 1px solid var(--divider-color);
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.12);
    color: var(--primary-text-color);
  }

  .sm-schedule-repeat-pill--all {
    padding-left: 10px;
    padding-right: 10px;
  }

  .btn-danger {
    padding: 6px 10px;
    font-size: 0.85em;
    border-radius: 4px;
    border: 1px solid var(--error-color, #db4437);
    background: transparent;
    color: var(--error-color, #db4437);
    cursor: pointer;
  }

  .btn-danger:hover {
    background: rgba(219, 68, 55, 0.12);
  }

  .btn-danger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .empty-hint {
    color: var(--secondary-text-color);
    font-size: 0.9em;
    line-height: 1.4;
    margin-bottom: 12px;
  }

  .create-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
  }

  .create-row input[type='text'] {
    flex: 1;
    min-width: 160px;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
  }

  .create-row button {
    padding: 8px 14px;
    border-radius: 4px;
    border: none;
    background: var(--primary-color);
    color: var(--text-primary-color);
    cursor: pointer;
  }

  .create-row button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  code.inline {
    font-size: 0.85em;
    background: rgba(127, 127, 127, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Frise 24 h — marge basse réduite (le dernier planning n’a pas besoin d’air sous le lien). */
  .timeline-frise {
    margin: 0 0 8px;
    padding: 0;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;
  }

  .sm-scheduler-frise {
    display: block;
    max-width: 100%;
  }

  .sm-scheduler-track {
    position: relative;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .sm-scheduler-bar {
    position: relative;
    width: 100%;
    height: 60px;
    box-sizing: border-box;
  }

  .sm-slot {
    display: flex;
    height: 100%;
    box-sizing: border-box;
    cursor: default;
    color: var(--text-primary-color);
    font-weight: 500;
    align-items: center;
    justify-content: center;
    word-break: break-word;
    white-space: normal;
    overflow: hidden;
    padding: 2px 4px;
    min-width: 3px;
    /* position / taille / fond en inline (pourcentage exact sur 24 h) */
  }

  .sm-scheduler-track--editor .sm-slot {
    cursor: pointer;
    touch-action: manipulation;
  }

  .sm-scheduler-track--editor .sm-slot.is-selected {
    cursor: grab;
    user-select: none;
    touch-action: none;
  }

  .sm-scheduler-track--editor .sm-slot.is-selected:active {
    cursor: grabbing;
  }

  .sm-slot--cap-start {
    border-radius: 10px 0 0 10px;
  }

  .sm-slot--cap-end {
    border-radius: 0 10px 10px 0;
  }

  /* Une seule plage sur la frise : les deux classes s’appliquent — sans cette règle, cap-end écrase cap-start (bord gauche carré). */
  .sm-slot--cap-start.sm-slot--cap-end {
    border-radius: 10px;
  }

  .sm-slot:hover {
    filter: brightness(1.08);
  }

  .sm-slot.is-selected {
    box-shadow:
      inset 0 0 0 3px rgba(255, 255, 255, 0.95),
      0 0 0 1px rgba(0, 0, 0, 0.35);
    z-index: 2;
  }

  /** Créneau actif : double trait dérivé de la couleur du bloc (variables posées en inline). */
  .sm-slot.sm-slot--now-active {
    z-index: 4;
    box-shadow:
      inset 0 0 0 2px var(--sm-slot-now-ring-1, rgba(255, 255, 255, 0.96)),
      inset 0 0 0 4px var(--sm-slot-now-ring-2, rgba(0, 0, 0, 0.82));
  }

  .sm-scheduler-track--editor .sm-slot.is-selected.sm-slot--now-active {
    z-index: 5;
    box-shadow:
      inset 0 0 0 2px var(--sm-slot-now-ring-1, rgba(255, 255, 255, 0.96)),
      inset 0 0 0 4px var(--sm-slot-now-ring-2, rgba(0, 0, 0, 0.82)),
      inset 0 0 0 7px rgba(255, 255, 255, 0.94),
      0 0 0 1px rgba(0, 0, 0, 0.4);
  }

  .sm-slot-label {
    font-size: 0.82rem;
    line-height: 1.2;
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }

  /* Barre d’heures (équivalent time-bar du scheduler-card) */
  .sm-time-bar {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 18px;
    margin-top: 4px;
    box-sizing: border-box;
  }

  .sm-time-bar-label {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    white-space: nowrap;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--secondary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sm-time-bar-label--left {
    justify-content: flex-start;
  }

  .sm-time-bar-label--right {
    justify-content: flex-end;
  }

  .sm-frise-heading {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    padding: 0 2px;
  }

  .sm-frise-heading-label {
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--primary-text-color);
  }

  /* Entités (formulaire plage) */
  .entity-picker-row {
    grid-column: 1 / -1;
  }

  .entity-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .entity-chip {
    display: inline-flex;
    align-items: stretch;
    gap: 0;
    padding: 0;
    font-size: 0.75rem;
    border-radius: 12px;
    background: rgba(127, 127, 127, 0.18);
    max-width: 100%;
    overflow: hidden;
  }

  .entity-chip-main {
    display: flex;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    border-radius: 12px 0 0 12px;
  }

  .entity-chip-main:hover {
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.12);
  }

  .entity-chip-remove {
    flex-shrink: 0;
    margin: 0;
    padding: 8px 10px;
    border: none;
    border-left: 1px solid var(--divider-color);
    background: transparent;
    cursor: pointer;
    color: var(--error-color, #c62828);
    font-size: 1rem;
    line-height: 1;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .entity-chip-remove:hover {
    background: rgba(var(--rgb-error-color, 198, 40, 40), 0.08);
  }

  .entity-chip-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .entity-chip-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--primary-text-color);
    line-height: 1.25;
    word-break: break-word;
  }

  .entity-chip-id {
    font-size: 0.68rem;
    color: var(--secondary-text-color);
    word-break: break-all;
    line-height: 1.2;
  }

  .entity-chip code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }

  .btn-open-config {
    display: inline-block;
    width: auto;
    max-width: 100%;
    margin: 4px 0 0;
    padding: 6px 2px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--secondary-text-color);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: color-mix(in srgb, var(--secondary-text-color) 35%, transparent);
    transition:
      color 0.15s ease,
      text-decoration-color 0.15s ease;
  }

  .btn-open-config:hover {
    color: var(--primary-color);
    text-decoration-color: var(--primary-color);
    filter: none;
  }

  /* Éditeur plein écran (style config HA) */
  .sm-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(0, 0, 0, 0.52);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top)) 12px 24px;
    overflow: auto;
    box-sizing: border-box;
  }

  .sm-modal {
    width: min(100%, 520px);
    max-width: calc(100vw - 24px);
    min-width: 0;
    margin-top: 8px;
    margin-bottom: 24px;
    border-radius: 12px;
    background: var(--card-background-color, var(--ha-card-background, #1e1e1e));
    border: 1px solid var(--divider-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    color: var(--primary-text-color);
    box-sizing: border-box;
    /* visible : évite de recadrer les listes déroulantes de ha-entity-picker (overflow hidden les masque parfois) */
    overflow-x: visible;
    overflow-y: visible;
  }

  .sm-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--divider-color);
  }

  .sm-modal-head h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
  }

  .sm-icon-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--secondary-text-color);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
  }

  .sm-icon-btn:hover {
    background: rgba(127, 127, 127, 0.2);
    color: var(--primary-text-color);
  }

  .sm-modal-sub {
    padding: 12px 16px 8px;
    font-size: 0.82em;
    color: var(--secondary-text-color);
  }

  .sm-modal-sub span {
    display: block;
    margin-bottom: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--primary-text-color);
  }

  .sm-repeat-days {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .sm-day {
    min-width: 2.85rem;
    padding: 10px 10px;
    border-radius: 10px;
    border: 1px solid var(--divider-color);
    background: transparent;
    color: var(--secondary-text-color);
    font-size: 0.95em;
    font-weight: 500;
    cursor: pointer;
  }

  .sm-day.on {
    border-color: var(--primary-color);
    background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.18);
    color: var(--primary-text-color);
    font-weight: 600;
  }

  .sm-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 4px 16px 14px;
    align-items: stretch;
  }

  .sm-tool-btn {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 0.92em;
    font-weight: 600;
    cursor: pointer;
  }

  .sm-tool-accent {
    border-color: rgba(33, 150, 243, 0.55);
    background: rgba(33, 150, 243, 0.15);
    color: var(--primary-color, #2196f3);
  }

  .sm-tool-btn.danger {
    border-color: rgba(219, 68, 55, 0.55);
    color: var(--error-color, #ef5350);
    background: rgba(239, 83, 80, 0.08);
  }

  .sm-tool-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sm-editor-frise {
    /* Pas de marge horizontale : avec width:100% sur .timeline-frise cela dépassait le modal (100% + 32px). */
    margin: 0 0 12px;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: clip;
    overflow-y: visible;
  }

  /* Frise éditeur : un peu plus d’air pour les poignées (translateX -50% sur les bords). */
  .timeline-frise.sm-editor-frise {
    padding-left: 16px;
    padding-right: 16px;
  }

  .sm-color-field {
    margin-bottom: 14px;
  }

  .sm-color-field-title {
    display: block;
    margin-bottom: 10px;
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--primary-text-color);
  }

  .sm-color-row {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .sm-color-system-label {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    flex-shrink: 0;
    cursor: pointer;
    max-width: min(100%, 160px);
  }

  .sm-color-system-text {
    font-size: 0.72em;
    line-height: 1.25;
    color: var(--secondary-text-color);
  }

  /* Pastille ronde : évite l’effet « gros rectangle bleu » du nuancier natif par défaut */
  .sm-color-native {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 2px solid var(--divider-color);
    border-radius: 50%;
    cursor: pointer;
    background: var(--card-background-color);
    box-sizing: border-box;
  }

  .sm-color-native::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .sm-color-native::-webkit-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .sm-color-native::-moz-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .sm-color-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .sm-color-swatch {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    cursor: pointer;
    padding: 0;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }

  .sm-color-swatch:hover {
    transform: scale(1.08);
  }

  .sm-color-reset {
    padding: 8px 12px;
    font-size: 0.8em;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
    white-space: nowrap;
  }

  .sm-color-reset:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sm-modal-body {
    padding: 0 16px 12px;
    min-width: 0;
  }

  .sm-form-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
    font-size: 0.78em;
    color: var(--secondary-text-color);
  }

  /*
   * Sans display:block + largeur, ha-entity-picker (élément personnalisé) peut
   * rester en ligne à largeur/hauteur nulles dans une colonne flex — invisible dans le modal.
   */
  .sm-form-label ha-entity-picker,
  .sm-action-card ha-entity-picker,
  .sm-entity-picker-shell ha-entity-picker {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 56px;
  }

  .sm-form-label input[type='text'] {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-family: inherit;
    font-size: 1rem;
  }

  .sm-form-label-last {
    margin-bottom: 0;
  }

  .sm-action-card {
    margin-top: 4px;
    padding: 0;
    border: none;
    background: transparent;
  }

  .sm-action-card h4 {
    margin: 0 0 10px;
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--primary-text-color);
  }

  .sm-field-hint {
    display: block;
    margin-top: 6px;
    font-size: 0.72em;
    line-height: 1.35;
    color: var(--secondary-text-color);
  }

  .sm-field-hint code {
    font-size: 0.95em;
    word-break: break-all;
  }

  .sm-field-hint-warn {
    color: var(--warning-color, #ff9800);
  }

  .sm-action-advanced {
    margin: 10px 0 6px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px dashed var(--divider-color);
    background: rgba(127, 127, 127, 0.04);
  }

  .sm-action-advanced summary {
    cursor: pointer;
    font-size: 0.82em;
    color: var(--secondary-text-color);
    user-select: none;
  }

  .sm-form-label-inner {
    margin-top: 8px;
    margin-bottom: 0;
  }

  .sm-modal-body-input-full {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-family: inherit;
    font-size: 0.95rem;
  }

  .sm-modal-body .sm-time-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px 16px;
    margin-bottom: 14px;
    align-items: start;
    width: 100%;
    box-sizing: border-box;
  }

  .sm-modal-body .sm-time-row label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.78em;
    color: var(--secondary-text-color);
    min-width: 0;
    margin: 0;
  }

  .sm-modal-body .sm-time-row input {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    min-width: 0;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-family: inherit;
    font-size: 1rem;
  }

  .sm-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
    padding: 14px 16px 16px;
    border-top: 1px solid var(--divider-color);
  }

  .btn-text {
    padding: 8px 4px;
    border: none;
    background: transparent;
    font-size: 0.95em;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-text.primary {
    color: var(--primary-color);
    font-weight: 600;
  }

  .btn-text.danger {
    color: var(--secondary-text-color);
    margin-right: auto;
  }

  .sm-scheduler-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 28px;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: ew-resize;
    z-index: 10;
    touch-action: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Poignée visible sur thème sombre / clair */
  .sm-scheduler-handle-grip {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    box-sizing: border-box;
    background: rgb(var(--rgb-primary-color, 33, 150, 243));
    border: 2px solid rgba(255, 255, 255, 0.92);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.28),
      0 2px 10px rgba(0, 0, 0, 0.35);
    pointer-events: none;
  }

  .sm-scheduler-handle:hover .sm-scheduler-handle-grip {
    filter: brightness(1.12);
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.5),
      0 3px 12px rgba(0, 0, 0, 0.35);
  }

  .sm-select {
    width: 100%;
    max-width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-family: inherit;
    font-size: 1rem;
    cursor: pointer;
  }

  /* Résumé + bouton principal « comme » l’UI horaire HA */
  .sm-action-entry {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 8px;
  }

  .sm-actions-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sm-action-block {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--divider-color);
    background: rgba(var(--rgb-primary-text-color, 221, 221, 221), 0.04);
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .sm-action-block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .sm-action-block-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .sm-action-block-remove {
    padding: 4px 10px;
    font-size: 0.78rem;
    border-radius: 6px;
    border: 1px solid var(--divider-color);
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
    font-family: inherit;
  }

  .sm-action-block-remove:hover {
    color: var(--error-color, #c62828);
    border-color: var(--error-color, #c62828);
  }

  .sm-action-block-wizard {
    align-self: flex-start;
    margin-top: 4px;
  }

  .sm-action-add-another-btn {
    align-self: stretch;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px dashed var(--divider-color);
    background: transparent;
    color: var(--primary-color);
    font-size: 0.9rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }

  .sm-action-add-another-btn:hover {
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.08);
  }

  .sm-entity-add-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .sm-entity-replace-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--divider-color);
  }

  .sm-entity-add-heading {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .sm-entity-add-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 32px;
  }

  .sm-entity-add-plus {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.12);
    color: var(--primary-color);
    font-size: 1.35rem;
    font-weight: 500;
    line-height: 1;
    font-family: inherit;
    cursor: pointer;
    box-sizing: border-box;
  }

  .sm-entity-add-plus:hover {
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.22);
  }

  .sm-entity-add-dismiss {
    flex-shrink: 0;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--primary-color);
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }

  .sm-entity-add-dismiss:hover {
    text-decoration: underline;
  }

  .sm-entity-picker-shell--popover {
    margin-top: 2px;
    min-height: 48px;
  }

  .sm-entity-manual-picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .sm-entity-manual-search {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    min-height: 48px;
    padding: 0 4px 0 10px;
    box-sizing: border-box;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--ha-card-background, var(--card-background-color));
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .sm-entity-manual-search:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }

  .sm-entity-manual-search-icon {
    flex-shrink: 0;
    color: var(--secondary-text-color);
    --mdc-icon-size: 22px;
  }

  .sm-entity-manual-filter {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 10px 8px;
    border: none;
    outline: none;
    background: transparent;
    color: var(--primary-text-color);
    font-family: inherit;
    font-size: 1rem;
  }

  .sm-entity-manual-filter::placeholder {
    color: var(--secondary-text-color);
    opacity: 0.85;
  }

  .sm-entity-manual-list {
    max-height: min(42vh, 320px);
    overflow-y: auto;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--ha-card-background, var(--card-background-color));
    min-width: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  .sm-entity-manual-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin: 0;
    padding: 10px 12px;
    border: none;
    border-bottom: 1px solid var(--divider-color);
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    box-sizing: border-box;
  }

  .sm-entity-manual-row:last-child {
    border-bottom: none;
  }

  .sm-entity-manual-row:hover {
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.08);
  }

  .sm-entity-manual-badge {
    flex-shrink: 0;
    line-height: 0;
    --state-badge-size: 40px;
  }

  .sm-entity-manual-icon-fallback {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(127, 127, 127, 0.22);
    color: var(--primary-text-color);
  }

  .sm-entity-manual-icon-fallback ha-icon {
    --mdc-icon-size: 22px;
  }

  .sm-entity-manual-row-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .sm-entity-manual-row-name {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--primary-text-color);
    line-height: 1.25;
    word-break: break-word;
  }

  .sm-entity-manual-row-id {
    font-size: 0.78rem;
    color: var(--secondary-text-color);
    line-height: 1.2;
    word-break: break-all;
  }

  .sm-entity-manual-empty {
    margin: 0;
    padding: 12px 10px;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--secondary-text-color);
  }

  .sm-action-climate-preset {
    margin-top: 4px;
  }

  .sm-actions-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .sm-action-tab-wrap {
    display: inline-flex;
    align-items: stretch;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--divider-color);
  }

  .sm-action-tab {
    padding: 6px 10px;
    border: none;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-family: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sm-action-tab.is-active {
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.15);
    font-weight: 600;
  }

  .sm-action-tab--add {
    border-radius: 8px;
    border: 1px dashed var(--divider-color);
    background: transparent;
  }

  .sm-action-tab-remove {
    padding: 0 6px;
    border: none;
    border-left: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--secondary-text-color);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  .sm-action-summary {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--divider-color);
    background: rgba(var(--rgb-primary-text-color, 221, 221, 221), 0.05);
    min-width: 0;
  }

  .sm-action-summary-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 6px;
    border-radius: 50%;
    box-sizing: border-box;
    color: var(--primary-color);
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.12);
  }

  .sm-action-summary-text {
    min-width: 0;
    flex: 1;
  }

  .sm-action-summary-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--primary-text-color);
    line-height: 1.25;
    word-break: break-word;
  }

  .sm-action-summary-sub {
    margin-top: 4px;
    font-size: 0.78em;
    color: var(--secondary-text-color);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
  }

  .sm-action-tech {
    font-size: 0.85em;
    opacity: 0.85;
    word-break: break-all;
  }

  .sm-action-primary-btn {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--primary-color);
    text-decoration: none;
  }

  .sm-action-primary-btn:hover {
    text-decoration: underline;
  }

  .sm-entity-picker-shell {
    display: block;
    width: 100%;
    min-width: 0;
    min-height: 52px;
    box-sizing: border-box;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    padding: 4px 6px;
    background: var(--ha-card-background, var(--card-background-color));
  }

  .sm-entity-picker-shell ha-entity-picker {
    display: block;
    width: 100%;
    min-width: 0;
    min-height: 44px;
  }

  .sm-action-entities-quick {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--divider-color);
  }

  .sm-action-entities-quick-title {
    display: block;
    font-size: 0.78em;
    font-weight: 600;
    color: var(--secondary-text-color);
    margin-bottom: 8px;
  }

  /* Assistant plein écran au-dessus du modal d’édition */
  .sm-action-wizard-overlay {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top)) 12px 24px;
    box-sizing: border-box;
    overflow: auto;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .sm-action-wizard-panel {
    width: min(100%, 440px);
    max-width: calc(100vw - 24px);
    margin-top: min(10vh, 48px);
    margin-bottom: 24px;
    border-radius: 12px;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid var(--divider-color);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    color: var(--primary-text-color);
    box-sizing: border-box;
    overflow: hidden;
  }

  .sm-action-wizard-head {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    gap: 4px;
    padding: 10px 8px 8px;
    border-bottom: 1px solid var(--divider-color);
  }

  .sm-ap-heading {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    text-align: center;
    line-height: 1.25;
  }

  .sm-ap-nav-btn {
    width: 40px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--primary-text-color);
    font-size: 1.35rem;
    line-height: 1;
    cursor: pointer;
    font-family: inherit;
  }

  .sm-ap-nav-btn:hover:not(:disabled) {
    background: rgba(127, 127, 127, 0.12);
  }

  .sm-ap-nav-btn:disabled {
    opacity: 0.28;
    cursor: default;
  }

  .sm-ap-context {
    margin: 10px 16px 6px;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--secondary-text-color);
  }

  .sm-ap-context strong {
    color: var(--primary-text-color);
    font-weight: 600;
  }

  .sm-ap-search {
    display: block;
    width: calc(100% - 32px);
    margin: 0 16px 10px;
    box-sizing: border-box;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    color: var(--primary-text-color);
    font-family: inherit;
    font-size: 0.95rem;
  }

  .sm-ap-scroll {
    max-height: min(52vh, 440px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 4px 0 12px;
  }

  .sm-ap-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    margin: 0;
    border: none;
    border-bottom: 1px solid rgba(127, 127, 127, 0.15);
    background: transparent;
    color: var(--primary-text-color);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    box-sizing: border-box;
  }

  .sm-ap-row:hover {
    background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.06);
  }

  .sm-ap-row-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    color: var(--secondary-text-color);
  }

  .sm-ap-row-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sm-ap-row-primary {
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.25;
    word-break: break-word;
  }

  .sm-ap-row-secondary {
    font-size: 0.72rem;
    color: var(--secondary-text-color);
    word-break: break-all;
    line-height: 1.25;
  }

  .sm-ap-row--dense .sm-ap-row-secondary {
    font-size: 0.68rem;
  }

  .sm-ap-chevron {
    flex-shrink: 0;
    font-size: 1.25rem;
    color: var(--secondary-text-color);
    opacity: 0.65;
    line-height: 1;
  }

  .sm-ap-empty {
    margin: 16px;
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    text-align: center;
  }
`;