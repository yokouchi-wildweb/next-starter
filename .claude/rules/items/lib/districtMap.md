---
paths:
  - "src/lib/districtMap/**"
---
# lib/districtMap
what: finds the app's districts (features, lib, frame, proxies) and what each holds by reading the existing declarations as text
  - closed lib with two entries: "." @/lib/districtMap/index.mjs (reads no file: readDistrictMap, field readers, kinds, declaration and name rules) and "./node" node.mjs (node:fs / node:path: readDistrictMapAt, collectPoints, overrideKeysOf, domainOutputs)
  - output src/registry/district-map.jsonl
use: always
change: none → /order <direct parent>
rules:
using:
- tools_only: app code never reads the map | src never imports district-map.jsonl (lint src-no-district-map) | the general rule = core/generated.md district_map_tools_only
- jsonl_generated: district-map.jsonl is pnpm generate district-map output, never hand-edited, never another generator's input
- problems_first: problems not empty → fix them before using the map
- kinds_closed: the 4 kinds are closed | another kind → /order Tier1
- name_clash: a business domain named like a core one → rename the business side
editing:
- entry_no_node_api: the "." entry never pulls a node API (node:fs, node:path); such parts go to node.mjs
- read_as_text: declarations are read as text, never executed | no new declaration files
- one_way: forkOwnership → districtMap only | nothing here (tests included) imports src/lib/forkOwnership
- single_source: extensionPoints.ts is read only by declarations.mjs (declarationFiles.mjs only finds the files) | name forms only in extensionNames.mjs / dottedNames.mjs
read: kinds, how found → Overview | entry → Usage | fields, readers → API | jsonl → Internals | tests → Verification
