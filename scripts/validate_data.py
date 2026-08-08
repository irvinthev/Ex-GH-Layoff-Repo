#!/usr/bin/env python3
import json
import sys
from jsonschema import Draft7Validator, RefResolver
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
PEOPLE_JSON = ROOT / 'people.json'
PLACED_JSON = ROOT / 'placed.json'
PEOPLE_SCHEMA = ROOT / 'data' / 'schemas' / 'people.schema.json'
PLACED_SCHEMA = ROOT / 'data' / 'schemas' / 'placed.schema.json'

errors_found = False

def load(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        print(f"ERROR: Failed to load {path}: {e}")
        sys.exit(2)


def human_path(p):
    if not p:
        return '<root>'
    parts = []
    for x in p:
        parts.append(str(x))
    return '.'.join(parts)


def _record_identifier(item, idx):
    # Preserve production field names. Try common variants when building a human
    # identifier for error output, but do not rename fields in source data.
    try:
        fn = ''
        ln = ''
        if isinstance(item, dict):
            fn = item.get('First Name') or item.get('First Name ') or item.get('firstName') or ''
            ln = item.get('Last Name') or item.get('Last Name ') or item.get('lastName') or ''
        identifier = f"{fn} {ln}".strip()
        if not identifier:
            identifier = f"#{idx}"
        return identifier
    except Exception:
        return f"#{idx}"


def validate(data, schema_path, name):
    """
    Validate the entire data structure (the JSON array) against the provided
    schema once. Preserve human-friendly record-level reporting by grouping
    validation errors by array index when possible.
    """
    global errors_found
    schema = json.loads(schema_path.read_text(encoding='utf-8'))
    resolver = RefResolver(base_uri=f'file://{schema_path.parent}/', referrer=schema)
    validator = Draft7Validator(schema, resolver=resolver)

    # Validate the whole document at once
    errors = list(validator.iter_errors(data))
    if not errors:
        return

    # Group errors that point to array indices so we can report them per-record.
    record_errors = defaultdict(list)
    top_level_errors = []

    for e in errors:
        path_list = list(e.path)
        if path_list and isinstance(path_list[0], int):
            idx = path_list[0]
            record_errors[idx].append((e, path_list[1:]))
        else:
            top_level_errors.append((e, path_list))

    # Print top-level errors first
    if top_level_errors:
        errors_found = True
        print(f"\n[{name}] Validation errors (document-level):")
        for e, path_list in top_level_errors:
            path = human_path(path_list)
            print(f"  - {e.message} (path: {path})")

    # Print per-record errors grouped by index
    for idx in sorted(record_errors.keys()):
        errors_found = True
        try:
            item = data[idx]
        except Exception:
            item = None
        identifier = _record_identifier(item, idx)
        print(f"\n[{name}] Validation errors in record #{idx} — {identifier}:")
        for e, rel_path in record_errors[idx]:
            path = human_path(rel_path)
            # If rel_path is empty, the error refers to the item itself (e.g. additionalProperties)
            if not rel_path:
                path = '<item>'
            print(f"  - {e.message} (field: {path})")


if __name__ == '__main__':
    # Ensure jsonschema is installed when running locally or in CI step we will pip install it
    if not PEOPLE_JSON.exists():
        print(f"ERROR: {PEOPLE_JSON} not found in repo root.")
        sys.exit(2)
    if not PLACED_JSON.exists():
        print(f"ERROR: {PLACED_JSON} not found in repo root.")
        sys.exit(2)
    people = load(PEOPLE_JSON)
    placed = load(PLACED_JSON)
    validate(people, PEOPLE_SCHEMA, 'people.json')
    validate(placed, PLACED_SCHEMA, 'placed.json')
    if errors_found:
        print("\nOne or more validation errors found. Failing.")
        sys.exit(3)
    print("All data validated successfully.")
