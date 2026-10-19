🇫🇷 [Version française](README.fr.md)

# Schedule Manager — Home Assistant integration

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=infernalK&repository=ha-schedule-manager&category=integration)
[![GitHub release](https://img.shields.io/github/v/release/infernalK/ha-schedule-manager)](https://github.com/infernalK/ha-schedule-manager/releases)
[![License](https://img.shields.io/github/license/infernalK/ha-schedule-manager)](LICENSE)

This integration adds **schedules** to Home Assistant: you define **time blocks** (e.g. 7 AM to 9 AM) and what should happen during that time (heating, lights, scenes, etc.).

---

## What is it for? (a simple example)

You want the living room radiator's *Comfort* mode to turn on **every morning from 7 AM to 9 AM**. You create a **schedule** (e.g. "Living room morning"), then add a **time block** with a start time, an end time, and the action you want. Home Assistant takes care of it automatically at the set times.

---

## What you need

- A **Home Assistant** instance that's already running (you know how to open **Settings** and a **dashboard**).
- To install easily without copying files by hand: **[HACS](https://hacs.xyz/)** (optional but recommended).

---

## A single install: integration + card

This integration **bundles its own Lovelace card** — no need to install a second repository. Installing **Schedule Manager** gives you:

- the **integration**, which **stores** your schedules, **triggers** actions at the right times, and creates the **switches** and the **status sensor**;
- the **"Schedule Manager" card**, which registers itself automatically as a dashboard resource on startup, ready to add to a view.

If you'd rather not use the card, you can still create schedules from **Settings** and, for detailed time blocks, use **Developer Tools** or **automations** (see below).

---

## Installation (easy method: HACS)

Schedule Manager is part of HACS's default repository: no need to add a custom repository anymore.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=infernalK&repository=ha-schedule-manager&category=integration)

1. Open **HACS** in the Home Assistant sidebar.
2. **Integrations** section → **Explore & download repositories** button → search for **Schedule Manager** → **Download**.
3. **Restart** Home Assistant if prompted.
4. Go to **Settings** → **Devices & services** → **Add integration** button (bottom right).
5. Search for **Schedule Manager** and follow the wizard to the end (**Finish**, or **Skip and finish** for room names — it's not blocking).

---

## Installation (manual method)

1. Copy the `custom_components/schedule_manager` folder into your installation's `config/custom_components/` folder (next to your other custom integrations).
2. **Restart** Home Assistant.
3. **Settings** → **Devices & services** → **Add integration** → search for **Schedule Manager**.

---

## After installation: where to find Schedule Manager

- **Settings** → **Devices & services**: you should see a **Schedule Manager** tile.
- Clicking it shows a **main device** "Schedule Manager" (with a sensor and often a global switch) and, later, **one device per schedule** you create (e.g. "Living room morning") with its own **switch** to enable or disable that schedule.

*Note:* depending on your Home Assistant version, the wizard may talk about "adding a service" rather than a physical device — that's normal, there's no hardware to plug in.

---

## Creating your first schedule (without the card)

1. **Settings** → **Devices & services** → **Schedule Manager**.
2. Click the integration's row, then **Configure** (**⋮** menu or button, depending on the UI).
3. Choose **Create schedule**.
4. Give it a clear **name** (e.g. "Morning heating") and confirm.

At this point the schedule exists, but **time blocks** are usually managed from the **Lovelace card** (recommended) or via the **services** described below if you're comfortable with YAML.

---

## Using the card for time blocks (recommended for beginners)

The card is already installed with the integration (no resource to add by hand). On a dashboard:

1. Three dots **⋮** → **Edit dashboard**.
2. **Add card** → search for **Schedule Manager** in the list, or pick **Manual card** and enter `custom:schedule-manager-card`.

From the card you can generally: **create** a schedule, **delete** a schedule, **add / remove** time blocks, **enable or disable** a schedule.

---

## A few words of vocabulary

| Term | Simple meaning |
|------|-----------------|
| **Schedule** | A named set of time-based rules (e.g. "office week"). |
| **Time block** | An interval in the day (start → end) during which **actions** are scheduled. |
| **Action** | A Home Assistant command (turn on a light, set the climate mode, etc.), usually described by a **service type** and **data** (sometimes JSON in the advanced UI). |
| **Status sensor** | A "probe" in Home Assistant that shows a summary; here it also holds **detailed information** (attributes) that the card reads to display your schedules. |
| **Service** | An action Home Assistant can run on demand (automation, button, card, etc.). All of this integration's services start with `schedule_manager.`. |

---

## Services (for users comfortable with automations / YAML)

These actions are also available under **Developer Tools** → **Services**. The exact names may be shown in your interface language.

| Service (technical ID) | What it does |
|-------------------------|---------------|
| `schedule_manager.create_schedule` | Create a schedule. At minimum: a **name**. |
| `schedule_manager.update_schedule` | Update an existing schedule (name, time blocks, repeat days…). Requires the schedule's identifier (`schedule_id`). |
| `schedule_manager.delete_schedule` | Delete a schedule. **Not possible** if it's the last remaining one: create another first. |
| `schedule_manager.enable_schedule` / `disable_schedule` | Enable or disable a schedule. |
| `schedule_manager.run_actions` | Force-run the current time block's actions (useful for testing). |
| `schedule_manager.set_override` / `clear_override` | Advanced options (temporary behavior); settings under the integration's **Configure** → **Advanced settings**. |

**Where to find `schedule_id`?** In **Developer Tools** → **States**, open the **sensor** of the "Schedule Manager" device (often named *Status* / *État* depending on language). In its **attributes**, look for `schedules`: each key (a string of letters and digits) is a `schedule_id`.

**Example** — a time block with two actions:

```yaml
service: schedule_manager.update_schedule
data:
  schedule_id: PASTE_YOUR_UUID_HERE
  time_blocks:
    - start_time: "07:00:00"
      end_time: "09:00:00"
      actions:
        - action_type: climate.set_preset_mode
          action_payload:
            entity_id: climate.living_room
            preset_mode: comfort
        - action_type: light.turn_on
          action_payload:
            entity_id: light.kitchen
```

An older format with a single action directly on the time block is still accepted; it's converted automatically.

---

## Entities: what you'll see in Home Assistant

- **"Schedule Manager" device**: holds the **sensor** used by the card (list of schedules in its attributes) and usually a global scheduling **switch**.
- **One device per schedule**: holds a **switch** named after the schedule — **on** = schedule active, **off** = schedule paused (equivalent to the enable/disable services).

**Sensor name for the card:** Home Assistant builds an entity ID like `sensor.schedule_manager_…` based on your interface **language** (e.g. `sensor.schedule_manager_status` in English, often `sensor.schedule_manager_etat` in French). If the card finds nothing, open the "Schedule Manager" hub device and pick the right sensor in the card's **editor**, or add `status_entity: …` to the card's YAML.

---

## Developing the card (contributors)

The card's TypeScript source lives in [`card/`](card/); the compiled file shipped to Home Assistant is `custom_components/schedule_manager/www/schedule-manager-card.js`, generated from that folder and **must not be hand-edited**.

```bash
cd card
npm install
npm run build   # regenerates custom_components/schedule_manager/www/schedule-manager-card.js
```
