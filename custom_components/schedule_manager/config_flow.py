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
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        default_override = self._options.get("default_override_duration", 3600)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "default_override_duration",
                        default=default_override,
                    ): vol.All(vol.Coerce(int), vol.Range(min=60)),
                }
            ),
        )
