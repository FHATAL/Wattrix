#!/usr/bin/env python3
"""Minimal, dependency-free CI check for the Wattrix static site.

Wattrix has no backend, no build step and no npm/pip dependencies (see
README.md), so there is nothing for npm/pip audit tooling to scan. This
script instead catches the two classes of regression most likely to break
the live site on wattrix.app:

1. JSON/XML files that don't parse (manifest.json, sitemap.xml).
2. Local links/scripts/stylesheets/images referenced from the HTML that
   point at a file which doesn't actually exist in the repo.

It uses only the Python standard library so it needs no install step.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

errors: list[str] = []

# --- 1. JSON files parse -----------------------------------------------
for json_path in ROOT.glob("*.json"):
    try:
        json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{json_path.relative_to(ROOT)}: invalid JSON ({exc})")

# --- 2. XML files parse --------------------------------------------------
for xml_path in ROOT.glob("*.xml"):
    try:
        ET.fromstring(xml_path.read_text(encoding="utf-8"))
    except ET.ParseError as exc:
        errors.append(f"{xml_path.relative_to(ROOT)}: invalid XML ({exc})")

# --- 3. Local references inside HTML resolve to real files ---------------
ATTR_RE = re.compile(r'(?:href|src)\s*=\s*"([^"]+)"', re.IGNORECASE)

def is_local(ref: str) -> bool:
    if not ref or ref.startswith("#"):
        return False
    if ref.startswith(("http://", "https://", "mailto:", "tel:", "data:", "//")):
        return False
    return True

for html_path in ROOT.glob("*.html"):
    text = html_path.read_text(encoding="utf-8")
    for match in ATTR_RE.finditer(text):
        ref = match.group(1)
        if not is_local(ref):
            continue
        path_part = urllib.parse.urlsplit(ref).path
        if not path_part:
            continue
        target = (html_path.parent / path_part).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            continue  # escapes repo root; not our concern here
        if not target.exists():
            errors.append(
                f"{html_path.relative_to(ROOT)}: broken local reference '{ref}'"
            )

# --- 4. manifest.json icons exist ----------------------------------------
manifest_path = ROOT / "manifest.json"
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for icon in manifest.get("icons", []):
        src = icon.get("src", "")
        if src and not (ROOT / src).exists():
            errors.append(f"manifest.json: missing icon file '{src}'")

if errors:
    print(f"FAILED: {len(errors)} issue(s) found\n")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("OK: JSON/XML parse cleanly and all local HTML references resolve.")
