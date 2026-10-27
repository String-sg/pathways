"""SG PSE Atlas course matcher. See matcher/README.md.

    from matcher import match
    results = match([{"subject": "English Language", "level": "O", "grade": "A2", "year": 2026}, ...],
                    bonus_inputs={"cca": "Excellent"}, exercises=["JAE-2027"])
"""

from .match import MATCHER_VERSION, CourseResult, load_requirements, match, match_report  # noqa: F401
from .exercises import EXERCISE_IDS, EXERCISES  # noqa: F401
