/**
 * Chargeur de la carte Schedule Manager (voir schedule-manager-card.js).
 *
 * Sur Safari / l'app mobile, le module de la carte pouvait être "chargé"
 * (import résolu) sans que l'élément soit défini, ce qui laissait la carte en
 * "Erreur de configuration" jusqu'à un rafraîchissement manuel. Ce chargeur
 * importe donc la carte sous une URL unique à chaque chargement de page,
 * vérifie que l'élément est bien défini (sinon réessaie), puis force Lovelace
 * à reconstruire les cartes restées en erreur.
 */
(function () {
  "use strict";

  const CARD_URL = "/schedule_manager_files/schedule-manager-card.js";
  const PROBE_TAG = "schedule-manager-card";
  const MAX_ATTEMPTS = 3;

  function rebuildErrorCards() {
    const walk = (root) =>
      Array.from(root.querySelectorAll("*")).flatMap((el) => [
        el,
        ...(el.shadowRoot ? walk(el.shadowRoot) : []),
      ]);
    for (const el of walk(document)) {
      if (el.localName !== "hui-error-card") continue;
      const message = String((el._config && el._config.message) || "");
      if (!message.includes("Custom element doesn't exist: schedule-manager-")) continue;
      el.dispatchEvent(new CustomEvent("ll-rebuild", { bubbles: true, composed: true }));
    }
  }

  async function load(attempt) {
    try {
      await import(`${CARD_URL}?t=${Date.now()}-${attempt}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Schedule Manager : échec du chargement de la carte", err);
    }
    if (customElements.get(PROBE_TAG)) {
      setTimeout(rebuildErrorCards, 300);
      setTimeout(rebuildErrorCards, 2000);
      return;
    }
    if (attempt < MAX_ATTEMPTS) {
      setTimeout(() => load(attempt + 1), 1000 * attempt);
    }
  }

  load(1);
})();
