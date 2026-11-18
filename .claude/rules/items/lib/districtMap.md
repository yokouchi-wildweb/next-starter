---
paths:
  - "src/lib/districtMap/**"
---
# lib/districtMap
what: finds the app's districts (features, lib, frame, proxies) and what each holds by reading the existing declarations as text | readDistrictMap (@/lib/districtMap), readDistrictMapAt (node.mjs) | output src/registry/district-map.jsonl
use: always
change: none → /order <direct parent>
rules:
using:
- tools_only: app code never reads the map | src never imports district-map.jsonl (lint src-no-district-map)
- jsonl_generated: district-map.jsonl is pnpm generate district-map output, never hand-edited, never another generator's input
- problems_first: problems not empty → fix them before using the map
- kinds_closed: the 4 kinds are closed | another kind → /order Tier1
- name_clash: a business domain named like a core one → rename the business side
editing:
- read_as_text: declarations are read as text, never executed | no new declaration files
- one_way: forkOwnership → districtMap only | nothing here (tests included) imports src/lib/forkOwnership
- single_source: extensionPoints.ts is read only by declarations.mjs | name forms only in extensionNames.mjs / dottedNames.mjs
read: kinds, how found → Overview | entry → Usage | fields, readers → API | jsonl → Internals | tests → Verification
