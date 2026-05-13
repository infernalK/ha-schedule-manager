# Schedule Manager Integration

Intégration Home Assistant pour des plannings à créneaux et actions (ex. climat).

## Installation

### Avec HACS (recommandé)

1. [HACS](https://hacs.xyz/) installé : **HACS → Intégrations personnalisées** (menu ⋮) → **Dépôt personnalisé** → URL `https://github.com/infernalK/ha-schedule-manager`, catégorie **Intégration** → **Ajouter**.
2. **Télécharger** le dépôt, puis redémarrer Home Assistant si demandé.
3. **Paramètres → Appareils et services → Ajouter une intégration** → *Schedule Manager*.

Pour un lien « Ajouter à HACS » depuis la doc : [générer un lien my.home-assistant.io](https://my.home-assistant.io/create-link/?redirect=hacs_repository) avec l’URL du dépôt ci-dessus.

**Marques (brands)** : pour figurer dans le catalogue HACS par défaut et les icônes dans l’UI, il faut une PR sur [home-assistant/brands](https://github.com/home-assistant/brands) (`custom_integrations/schedule_manager/`). Tant que ce n’est pas fusionné, la CI du dépôt ignore volontairement la vérification `brands` (voir `.github/workflows/ci.yml`).

**Description et topics GitHub** : sur la page du dépôt, **About** (roue dentée) → renseigner une courte description (ex. *Intégration Home Assistant : plannings à créneaux et actions*) et des topics (`home-assistant`, `hacs`, `integration`, `schedule`, etc.). Cela satisfait aussi le validateur HACS ; vous pouvez alors retirer `topics` et `description` de `ignore` dans `.github/workflows/ci.yml`.

### Manuellement

1. Copiez `custom_components/schedule_manager` dans le dossier `custom_components` de Home Assistant.
2. Redémarrez Home Assistant.
3. **Paramètres → Appareils et services → Ajouter une intégration** → recherchez *Schedule Manager*.

### « Ajouter un pont » vs « Ajouter un service / appareil »

Le manifeste utilise `integration_type: "service"` : ce type correspond à une **intégration sans matériel physique** (logique + stockage local). Le libellé exact dépend de la version et de la langue de l’interface Home Assistant.

Les entités sont regroupées sous **un appareil logique** « Schedule Manager » (capteur d’état + commutateur), visible dans l’onglet **Appareils** lié à la passerelle de configuration.

## Plannings : ajout, suppression, plages horaires

### Via l’intégration (recommandé pour **créer** un planning)

1. **Paramètres → Appareils et services → Schedule Manager**.
2. Ouvrez l’entrée d’intégration, puis **Configurer** (menu des trois points ou bouton équivalent).
3. Choisissez **Créer un planning** / **Create schedule**, saisissez le **nom**, validez.
4. Un **appareil** et un **interrupteur** pour ce planning apparaissent ; les **plages** se définissent ensuite sur le tableau de bord (carte) ou via `schedule_manager.update_schedule`.

### Via la carte Lovelace

Après installation de la [Schedule Manager Card](https://github.com/infernalK/ha-schedule-manager-card), vous pouvez :

- créer un planning (nom) ;
- **Supprimer** un planning ;
- voir les **plages** (début, fin, type d’action, payload JSON) ;
- **Retirer** une plage ;
- **Ajouter une plage** (heures, type d’action, payload JSON — ex. climat : `set_preset_mode` et `{"preset_mode":"comfort"}`).

### Via les services (Automatisations / Outils de développement)

| Service | Rôle |
|--------|------|
| `schedule_manager.create_schedule` | Créer un planning (`name` obligatoire ; `time_blocks`, `repeat_days` optionnels) |
| `schedule_manager.update_schedule` | Modifier un planning : `schedule_id` obligatoire ; `name`, `enabled`, `repeat_days`, `time_blocks` (liste complète si vous modifiez les plages) |
| `schedule_manager.delete_schedule` | Supprimer un planning (`schedule_id`) — **refusé** s’il ne reste qu’un seul planning (il faut en créer un autre avant). |
| `schedule_manager.enable_schedule` / `disable_schedule` | Activer / désactiver |
| `schedule_manager.create_group`, `set_active_schedule`, … | Groupes exclusifs, etc. |

**Exemple YAML** — une plage avec **plusieurs actions** (services Home Assistant) :

```yaml
service: schedule_manager.update_schedule
data:
  schedule_id: VOTRE_UUID_PLANNING
  time_blocks:
    - start_time: "07:00:00"
      end_time: "09:00:00"
      actions:
        - action_type: climate.set_preset_mode
          action_payload:
            entity_id: climate.salon
            preset_mode: comfort
        - action_type: light.turn_on
          action_payload:
            entity_id: light.cuisine
```

L’ancien format avec `action_type` / `action_payload` directement sous la plage est encore accepté ; au chargement il est converti en une entrée dans `actions`.

Les identifiants `schedule_id` sont ceux affichés dans les **attributs** du capteur `schedules` (clés de l’objet).

## Services (liste complète)

- `schedule_manager.create_schedule`
- `schedule_manager.update_schedule`
- `schedule_manager.delete_schedule`
- `schedule_manager.enable_schedule` / `disable_schedule`
- `schedule_manager.create_group`
- `schedule_manager.enable_group` / `disable_group`
- `schedule_manager.set_active_schedule`
- `schedule_manager.set_override` / `clear_override`

## Entités et appareils

- **Appareil « Schedule Manager » (hub)** : capteur d’état (résumé + attributs pour la carte Lovelace) et commutateur générique.
- **Un appareil par planning** : chaque planning apparaît comme **appareil séparé** (nom du planning), relié au hub via *via_device*. Il contient une **entité commutateur** avec le nom du planning : elle reflète **activé / désactivé** pour ce planning (équivalent aux services `enable_schedule` / `disable_schedule`).

Les plannings créés ou supprimés (carte, services, automatisations) ajoutent ou retirent automatiquement ces appareils / entités.

Les `entity_id` exacts dépendent de votre installation (`sensor.schedule_manager_<entry>_status`, `switch.<nom_du_planning>`, etc.).
