# Schedule Manager — intégration Home Assistant

Cette extension ajoute à Home Assistant des **plannings** : vous définissez des **créneaux** (par ex. de 7 h à 9 h) et ce qui doit se passer à ce moment-là (chauffage, lumières, scènes, etc.).

---

## À quoi ça sert ? (exemple simple)

Vous voulez que le mode *Confort* du radiateur du salon soit activé **tous les matins de 7 h à 9 h**. Vous créez un **planning** (ex. « Matin salon »), puis vous y ajoutez une **plage** avec l’heure de début, l’heure de fin et l’action voulue. Home Assistant s’en occupe automatiquement aux horaires prévus.

---

## Ce dont vous avez besoin

- Une instance **Home Assistant** qui tourne déjà (vous savez ouvrir **Paramètres** et un **tableau de bord**).
- Pour installer facilement sans copier de fichiers à la main : **[HACS](https://hacs.xyz/)** (optionnel mais recommandé).

---

## Deux choses à installer pour une utilisation confortable

| Quoi ? | Rôle en une phrase |
|--------|-------------------|
| **Cette intégration** (dépôt *ha-schedule-manager*) | Elle **enregistre** vos plannings, **déclenche** les actions aux bonnes heures et crée les **interrupteurs** et le **capteur d’état** dans Home Assistant. |
| **[Schedule Manager Card](https://github.com/infernalK/ha-schedule-manager-card)** (autre dépôt) | Une **carte** sur votre tableau de bord pour **voir** et **modifier** les plannings à la souris, sans tout écrire en code. |

**Important :** la carte **ne suffit pas** seule. Il faut d’abord installer et ajouter **Schedule Manager** comme intégration (étapes ci-dessous). Ensuite seulement, vous installez la carte sur le même Home Assistant.

Si vous n’installez pas la carte, vous pouvez quand même créer des plannings depuis **Paramètres** et, pour les horaires détaillés, utiliser les **outils pour développeurs** ou des **automatisations** (voir plus bas).

---

## Installation (méthode simple : HACS)

1. Ouvrez **HACS** dans la barre latérale de Home Assistant.
2. Menu **⋮** (trois points) → **Dépôts personnalisés** (ou équivalent selon votre langue).
3. Collez l’adresse : `https://github.com/infernalK/ha-schedule-manager`  
   - Catégorie : **Intégration** → **Ajouter**.
4. Revenez dans HACS → section **Intégrations** → cherchez **Schedule Manager** → **Télécharger**.
5. Si Home Assistant le demande, **redémarrez** la machine ou le conteneur.
6. Allez dans **Paramètres** → **Appareils et services** → bouton **Ajouter une intégration** (en bas à droite).
7. Cherchez **Schedule Manager** et suivez l’assistant jusqu’au bout (**Terminer** ou **Ignorer et terminer** pour les noms de pièces, ce n’est pas bloquant).

Lien utile pour ouvrir HACS depuis la doc : [créer un lien my.home-assistant.io vers HACS](https://my.home-assistant.io/create-link/?redirect=hacs_repository) en collant l’URL du dépôt ci-dessus.

---

## Installation (méthode manuelle)

1. Copiez le dossier `custom_components/schedule_manager` à l’intérieur du dossier `config/custom_components/` de votre installation (à côté des autres extensions personnalisées).
2. **Redémarrez** Home Assistant.
3. **Paramètres** → **Appareils et services** → **Ajouter une intégration** → recherchez **Schedule Manager**.

---

## Après l’installation : où retrouver Schedule Manager ?

- **Paramètres** → **Appareils et services** : vous devriez voir une tuile **Schedule Manager**.
- En cliquant dessus, vous verrez un **appareil principal** « Schedule Manager » (avec un capteur et souvent un interrupteur global) et, plus tard, **un appareil par planning** que vous créerez (ex. « Matin salon ») avec son **interrupteur** pour activer ou désactiver ce planning.

*Note :* selon la version de Home Assistant, l’assistant peut parler d’« ajouter un service » plutôt que d’un appareil physique — c’est normal, il n’y a pas de boîtier à brancher.

---

## Créer votre premier planning (sans la carte)

1. **Paramètres** → **Appareils et services** → **Schedule Manager**.
2. Cliquez sur la ligne de l’intégration, puis **Configurer** (menu **⋮** ou bouton selon l’interface).
3. Choisissez **Créer un planning** (ou **Create schedule** en anglais).
4. Donnez un **nom** clair (ex. « Chauffage matin ») et validez.

À ce stade, le planning existe, mais les **plages horaires** se gèrent le plus souvent depuis la **carte Lovelace** (recommandé) ou via les **services** décrits plus bas si vous êtes à l’aise avec le YAML.

---

## Utiliser la carte pour les horaires (recommandé pour débuter)

Installez la **[Schedule Manager Card](https://github.com/infernalK/ha-schedule-manager-card)** (voir le README de ce dépôt : installation HACS ou copie du fichier `.js`). Ensuite, sur un tableau de bord :

1. Trois points **⋮** → **Modifier le tableau de bord**.
2. **Ajouter une carte** → en bas, **Carte personnalisée** (ou saisie manuelle selon votre thème).
3. Choisissez **Schedule Manager** si elle apparaît, ou collez le YAML minimal du README de la carte.

Depuis la carte vous pourrez en général : **créer** un planning, **supprimer** un planning, **ajouter / retirer** des plages, **activer ou désactiver** un planning.

---

## Quelques mots de vocabulaire

| Terme | Signification simple |
|-------|----------------------|
| **Planning** | Un ensemble de règles horaires (ex. « semaine bureau ») avec un nom. |
| **Plage** (ou créneau) | Un intervalle dans la journée (début → fin) pendant lequel des **actions** sont prévues. |
| **Action** | Une commande Home Assistant (allumer une lumière, régler le climat, etc.), souvent décrite par un **type de service** et des **données** (parfois en JSON dans l’interface avancée). |
| **Capteur d’état** | Une « sonde » dans Home Assistant qui affiche un résumé ; ici il contient aussi des **informations détaillées** (attributs) que la carte lit pour afficher vos plannings. |
| **Service** | Une action que Home Assistant peut lancer sur demande (automatisation, bouton, carte, etc.). Tous les services de cette extension commencent par `schedule_manager.`. |

---

## Services (pour utilisateurs à l’aise avec les automatisations / YAML)

Ces actions sont aussi disponibles dans **Outils de développement** → **Services**. Les noms exacts peuvent être affichés en français dans l’interface selon votre langue.

| Service (identifiant technique) | À quoi il sert |
|--------------------------------|----------------|
| `schedule_manager.create_schedule` | Créer un planning. Au minimum : un **nom**. |
| `schedule_manager.update_schedule` | Modifier un planning existant (nom, plages, jours de répétition…). Il faut l’identifiant du planning (`schedule_id`). |
| `schedule_manager.delete_schedule` | Supprimer un planning. **Impossible** s’il ne reste qu’un seul planning : créez-en un autre avant. |
| `schedule_manager.enable_schedule` / `disable_schedule` | Activer ou désactiver un planning. |
| `schedule_manager.run_actions` | Forcer l’exécution des actions du créneau actuel (utile pour tester). |
| `schedule_manager.set_override` / `clear_override` | Options avancées (comportement temporaire) ; réglages dans **Configurer** → **Réglages avancés** de l’intégration. |

**Où trouver `schedule_id` ?** Dans **Outils de développement** → **États**, ouvrez le **capteur** de l’appareil « Schedule Manager » (souvent nommé *État* / *Status* selon la langue). Dans les **attributs**, repérez `schedules` : chaque clé (suite de lettres et chiffres) est un `schedule_id`.

**Exemple** — une plage avec deux actions :

```yaml
service: schedule_manager.update_schedule
data:
  schedule_id: COLLEZ_ICI_VOTRE_UUID
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

Un ancien format avec une seule action directement sur la plage est encore accepté ; il est converti automatiquement.

---

## Entités : ce que vous verrez dans Home Assistant

- **Appareil « Schedule Manager »** : contient le **capteur** utilisé par la carte (liste des plannings dans les attributs) et souvent un **interrupteur** global de planification.
- **Un appareil par planning** : contient un **interrupteur** portant le nom du planning — **allumé** = planning actif, **éteint** = planning en pause (équivalent aux services activer / désactiver).

**Nom du capteur pour la carte :** Home Assistant construit un identifiant du type `sensor.schedule_manager_…` en fonction de la **langue** de l’interface (ex. `sensor.schedule_manager_status` en anglais, souvent `sensor.schedule_manager_etat` en français). Si la carte ne trouve rien, ouvrez l’appareil hub **Schedule Manager** et choisissez le bon capteur dans l’**éditeur** de la carte ou ajoutez `status_entity: …` dans le YAML de la carte (voir README de la carte).
