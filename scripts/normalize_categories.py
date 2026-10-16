"""Normalize category labels without inferring or changing a candidate's function."""

import re

CANONICAL_FUNCTIONS = (
    "Engineering",
    "Customer Care & Support",
    "Operations",
    "Product Design",
    "Product",
    "Go to Market",
    "Data & Analytics",
    "Legal / Risk / Compliance",
    "Sales / Business Development",
    "Marketing / Communications",
    "Customer Success / Account Management",
    "Project / Program Management",
    "Corporate Functions",
)


def _clean(value):
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    return re.sub(r"\s*([/&])\s*", r" \1 ", value)


_CANONICAL_LOOKUP = {_clean(value).casefold(): value for value in CANONICAL_FUNCTIONS}


def normalize_function(value):
    """Canonicalize known labels; preserve unknown categories for human review."""
    clean = _clean(value)
    return _CANONICAL_LOOKUP.get(clean.casefold(), clean)
