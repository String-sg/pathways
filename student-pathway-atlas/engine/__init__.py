"""SG PSE Atlas aggregate engine. See engine/README.md.

    from engine import compute_all
    results = compute_all([{"subject": "English Language", "level": "O", "grade": "A2", "year": 2026}, ...])
"""

from .api import Result, check_inputs, compute, compute_all  # noqa: F401
from .definitions import DEFINITIONS, DEFINITIONS_BY_ID  # noqa: F401

ENGINE_VERSION = "0.1.7"
