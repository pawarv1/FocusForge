import re

VALID_CATEGORIES = {
    "CLASS",
    "MEETING",
    "DEADLINE",
    "EXAM_INTERVIEW",
    "EVENT",
    "TASK_FOCUS",
    "GENERAL",
}

TAG_ALIASES = {
    "EXAM": "EXAM_INTERVIEW",
    "INTERVIEW": "EXAM_INTERVIEW",
    "EXAM_INTERVIEW": "EXAM_INTERVIEW",
    "FOCUS": "TASK_FOCUS",
    "POMODORO": "TASK_FOCUS",
    "TASK_FOCUS": "TASK_FOCUS",
    "CLASS": "CLASS",
    "LECTURE": "CLASS",
    "MEETING": "MEETING",
    "DEADLINE": "DEADLINE",
    "DUE": "DEADLINE",
    "EVENT": "EVENT",
    "GENERAL": "GENERAL",
}

TAG_PATTERN = re.compile(r"^\[([^\]]+)\]\s*(.*)$")


def parse_calendar_event(component, raw_summary: str) -> tuple[str, str]:
    """
    Resolve an event's category and return a cleaned display title.
    Priority:
      1. Native iCal CATEGORIES property
      2. Explicit bracket prefix in summary, e.g. "[Exam] CSC380 Midterm" -> ("CSC380 Midterm", "EXAM_INTERVIEW")
      3. Keyword fallback on the title
    """
    summary = raw_summary.strip() or "Untitled Event"
    clean_title = summary

    # Check if there is a leading [Tag] prefix and extract both the tag and cleaned title
    match = TAG_PATTERN.match(summary)
    prefix_category = None

    if match:
        raw_tag = match.group(1).strip().upper().replace(" ", "_").replace("/", "_")
        remainder = match.group(2).strip()
        if remainder:
            clean_title = remainder

        if raw_tag in TAG_ALIASES:
            prefix_category = TAG_ALIASES[raw_tag]
        elif raw_tag in VALID_CATEGORIES:
            prefix_category = raw_tag

    # 1. Native iCal CATEGORIES property
    raw_cats = component.get("categories")
    if raw_cats:
        cat_list = raw_cats.cats if hasattr(raw_cats, "cats") else [str(raw_cats)]
        for c in cat_list:
            normalized = str(c).strip().upper().replace(" ", "_").replace("/", "_")
            if normalized in TAG_ALIASES:
                return clean_title, TAG_ALIASES[normalized]
            if normalized in VALID_CATEGORIES:
                return clean_title, normalized

    # 2. Explicit [Tag] prefix match
    if prefix_category:
        return clean_title, prefix_category

    # 3. Keyword fallback
    title_lower = clean_title.lower()
    if any(k in title_lower for k in ["exam", "midterm", "final", "interview", "oa ", "assessment"]):
        return clean_title, "EXAM_INTERVIEW"
    if any(k in title_lower for k in ["lecture", "class", "lab", "recitation", "csc"]):
        return clean_title, "CLASS"
    if any(k in title_lower for k in ["sync", "meeting", "1:1", "standup"]):
        return clean_title, "MEETING"
    if any(k in title_lower for k in ["due", "deadline", "cutoff", "submit"]):
        return clean_title, "DEADLINE"
    if any(k in title_lower for k in ["focus", "pomodoro", "deep work", "study"]):
        return clean_title, "TASK_FOCUS"
    if any(k in title_lower for k in ["workshop", "hackathon", "seminar", "showcase", "poster"]):
        return clean_title, "EVENT"

    return clean_title, "GENERAL"