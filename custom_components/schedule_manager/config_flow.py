"""Config flow for Schedule Manager."""

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback

from .const import DOMAIN
from .models import Schedule
from .services import async_persist, async_sync_planning_entities


class ScheduleManagerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Schedule Manager."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        await self.async_set_unique_id(DOMAIN)
        if user_input is not None:
            return self.async_create_entry(title="Schedule Manager", data=user_input or {})

        self._abort_if_unique_id_configured()

        return self.async_show_form(
            step_id="user",
            data_schema=None,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """Get the options flow for this handler."""
        return ScheduleManagerOptionsFlow(config_entry)


class ScheduleManagerOptionsFlow(OptionsFlow):
    """Handle options.

    Ne pas assigner ``self.config_entry`` : la classe parent ``OptionsFlow``
    expose déjà une propriété ``config_entry`` basée sur ``handler``.
    """

    def __init__(self, config_entry: ConfigEntry) -> None:
        """Initialize options flow (copie des options, comme les intégrations core)."""
        self._options = dict(config_entry.options)

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Menu : créer un planning ou options avancées."""
        if user_input is not None:
            menu_option = user_input.get("menu_option")
            if menu_option == "add_schedule":
                return await self.async_step_add_schedule()
            if menu_option == "advanced":
                return await self.async_step_advanced()

        return self.async_show_menu(
            step_id="init",
            menu_options=["add_schedule", "advanced"],
        )

    async def async_step_advanced(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Durée d’override par défaut (stockée dans les options d’entrée)."""
        default_override = self._options.get("default_override_duration", 3600)

        if user_input is not None:
            merged = {**self._options, **user_input}
            return self.async_create_entry(title="", data=merged)

        return self.async_show_form(
            step_id="advanced",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "default_override_duration",
                        default=default_override,
                    ): vol.All(vol.Coerce(int), vol.Range(min=60)),
                }
            ),
        )

    async def async_step_add_schedule(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Créer un planning vide (plages ensuite via la carte Lovelace ou les services)."""
        if user_input is not None:
            name = str(user_input.get("name", "")).strip()
            if not name:
                return self.async_show_form(
                    step_id="add_schedule",
                    data_schema=vol.Schema({vol.Required("name"): str}),
                    errors={"base": "empty_name"},
                )

            storage = self.hass.data.get(DOMAIN, {}).get("storage")
            if storage is None:
                return self.async_abort(reason="storage_unavailable")

            schedule = Schedule(name=name)
            storage.add_schedule(schedule)
            await async_persist(self.hass, storage)
            await async_sync_planning_entities(self.hass)

            return await self.async_step_init()

        return self.async_show_form(
            step_id="add_schedule",
            data_schema=vol.Schema({vol.Required("name"): str}),
        )
