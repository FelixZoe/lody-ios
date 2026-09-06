#!/bin/bash
set -euo pipefail
# Run with Lody's tabs visible on an explicitly selected simulator.
lody_device="${1:?Pass the simulator UDID}"
lody_output="${2:-$(mktemp -d /tmp/lody-search-check.XXXXXX)}"
mkdir -p "$lody_output"
axe tap --label 搜索 --element-type RadioButton --udid "$lody_device" --post-delay 0.6
axe type 'lody-layout-check' --udid "$lody_device"
axe describe-ui --udid "$lody_device" > "$lody_output/search.json"
python3 - "$lody_output/search.json" <<'PY'
import json, sys

def nodes(value):
    if isinstance(value, list):
        for item in value: yield from nodes(item)
    elif isinstance(value, dict):
        yield value
        yield from nodes(value.get('children', []))

items = list(nodes(json.load(open(sys.argv[1]))))
field = next(item for item in items if item.get('AXUniqueId') == 'catalog-search-input')
close = next(item for item in items if item.get('AXUniqueId') == 'catalog-search-close')
assert field.get('AXValue') == 'lody-layout-check', 'Search did not receive focus/input'
assert field['frame']['x'] < 50, 'Search retained a leading tab button'
assert close['frame']['width'] >= 44, 'Close target is too small'
assert not any(item.get('type') == 'RadioButton' for item in items), 'Underlying tabs remain accessible'
PY
xcrun simctl io "$lody_device" screenshot "$lody_output/search.png"
axe tap --id catalog-search-close --udid "$lody_device" --post-delay 0.4
axe describe-ui --udid "$lody_device" > "$lody_output/closed.json"
python3 - "$lody_output/closed.json" <<'PY'
import json, sys

def nodes(value):
    if isinstance(value, list):
        for item in value: yield from nodes(item)
    elif isinstance(value, dict):
        yield value
        yield from nodes(value.get('children', []))

items = list(nodes(json.load(open(sys.argv[1]))))
assert any(item.get('type') == 'RadioButton' and item.get('AXLabel') == '搜索' for item in items), 'Close did not restore tabs'
assert not any(item.get('AXUniqueId') == 'catalog-search-input' for item in items), 'Search remained open'
PY
