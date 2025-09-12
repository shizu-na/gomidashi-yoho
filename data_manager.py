import os
import json
import logging

logger = logging.getLogger(__name__)

def get_schedule() -> list:
    """
    Loads the garbage schedule from the GARBAGE_SCHEDULE environment variable.

    Returns:
        list: A list of schedule dictionaries, or an empty list if not found or invalid.
    """
    json_str = os.getenv('GARBAGE_SCHEDULE', '{}')
    
    try:
        # The entire JSON string is parsed first
        data = json.loads(json_str)
        # Then, we access the 'schedules' key within the parsed data.
        return data.get('schedules', [])
    except json.JSONDecodeError:
        logger.error("Failed to decode GARBAGE_SCHEDULE JSON. Please check its format.")
        return []
    except Exception as e:
        logger.error(f"An unexpected error occurred while loading schedule: {e}")
        return []
