---
paths:
  - "src/config/**"
  - "src/business/**"
  - "src/styles/*.css"
  - "**/*.override.ts"
  - "**/*.replace*"
  - "**/*.default*"
  - "src/app/**/_components/**"
  - "src/app/**/_screen/**"
  - "src/app/**/_layout/**"
  - "src/lib/forkOwnership/**"
---
# change
> **ROLE**: loaded when writing a place a lower repo may change (config, own styles, .override / .replace / .default, _components) | holds the change types (CHANGE_TYPES)
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

change_types (the only 4 ways to change an upstream thing | marks = .default / .replace / .override, upstream files are plain | table → scripts/structure/extensions/README.md「4 つの型」):
- 1 whole (code): \<name\>.default + plain 1-line switch → fork \<name\>.replace, repoint the switch | screens: page.tsx switch, default _screen/ → fork _components/\<X\>Screen.tsx | frame: layout.tsx switch → fork _layout/\<Layout\>.replace.tsx beside the default (fork frame parts → route's _components/, plain names)
- 2 overlay (data): plain target + declared keys (overrideOf / overrides) → fork \<target\>.override.ts, declared keys only | frame: creator frame.ts → lower repo frame.override.ts
- 3 add: plain new name in a declared receptacle folder | 4 placement (values): src/styles/core/\<name\>.css → src/styles/\<name\>.css, owner config.ts → src/config/{lib,features,layout,proxies}/\<name\>.config.ts
- none → /order \<direct parent\> | no means to overlay part of code → upstream exposes it by value / receptacle / split
- tell: sibling .default = 1 | declaration above = 2 / 3 | placement declaration = 4 | none = cannot change
- who: `pnpm workflow ownership who <path>` answers type 1-4 | generated | own | none (ref: src/lib/forkOwnership/README.md)
- safety limits are never loosened: admin menu allowRoles narrow-only, core role enabled, profile fields, setting schema
- violations: *.default.* beside a parent's file, editing a parent's .default, plain frame.ts beside an upstream route, frame.default.ts (fails) | own .default in own area OK (middle tier too)
