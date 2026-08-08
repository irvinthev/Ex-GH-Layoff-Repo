#!/usr/bin/env python3
import json
import sys
from jsonschema import Draft7Validator, RefResolver
from pathlib import Path

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
    return '.'.join(str(x) for x in p)

def validate(data, schema_path, name):
    global errors_found
    schema = json.loads(schema_path.read_text(encoding='utf-8'))
    resolver = RefResolver(base_uri=f'file://{schema_path.parent}/', referrer=schema)
    validator = Draft7Validator(schema, resolver=resolver)
    for idx, item in enumerate(data):
        errors = list(validator.iter_errors(item))
        if errors:
            errors_found = True
            # Record identifier
            identifier = ''
            try:
                fn = item.get('First Name','')
                ln = item.get('Last Name','')
                identifier = f"{fn} {ln}".strip()
            except Exception:
                identifier = f"#${idx}"
            print(f"\n[{name}] Validation errors in record #{idx} — {identifier}:")
            for e in errors:
                path = human_path(e.path)
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
