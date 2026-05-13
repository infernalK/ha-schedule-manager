"""Constants for Schedule Manager integration."""

DOMAIN = "schedule_manager"
VERSION = "0.1.0"

# Storage keys
STORAGE_KEY = f"{DOMAIN}_data"
STORAGE_VERSION = 1

# Default values
DEFAULT_OVERRIDE_DURATION = 3600  # 1 hour in seconds

# Clés ajoutées par la carte Lovelace (couleur frise) — absentes des schémas de service HA.
ACTION_PAYLOAD_META_KEYS = frozenset({"schedule_manager_color"})

# Action types
ACTION_SET_PRESET_MODE = "set_preset_mode"
ACTION_SET_TEMPERATURE = "set_temperature"
ACTION_CALL_SERVICE = "call_service"
ACTION_RUN_SCRIPT = "run_script"

# Platforms
PLATFORMS = ["sensor", "switch"]