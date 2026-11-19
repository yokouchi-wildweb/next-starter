---
paths:
  - "src/config/**"
  - "src/business/**"
  - "src/styles/*.css"
  - "**/*.override.ts"
  - "**/*.replace*"
  - "**/*.default*"
  - "src/app/**/{_components/**,_layout/**,frame*.ts,favicon.ico}"
  - "src/lib/forkOwnership/intake.txt"
---
# change
> **ROLE**: loaded when writing a place a lower repo may change (config, own styles, .override / .replace / .default, _components) | holds the change types (CHANGE_TYPES)
> Tier1-owned: forks never edit (gap → /order <direct parent>)

change_types (the only 4 ways to change an upstream thing | marks = .default / .replace / .override, upstream files are plain | table → scripts/structure/extensions/README.md「4 つの型」):
- 1 whole (code): \<name\>.default + plain 1-line switch → fork \<name\>.replace, repoint the switch | screens carry no mark: the page.tsx 1-line switch is the declaration, default _screen/ → fork plain _components/\<X\>Screen.tsx | frame: layout.tsx switch → fork _layout/\<Layout\>.replace.tsx beside the default (fork frame parts → route's _components/, plain names)
- 2 overlay (data): plain target + declared keys (overrideOf / overrides) → fork \<target\>.override.ts, declared keys only | frame: creator frame.ts → lower repo frame.override.ts
- 3 add: plain new name in a declared receptacle folder | 4 placement (values): src/styles/core/\<name\>.css → src/styles/\<name\>.css, owner config.ts → src/config/\<area\>/\<name\>.config.ts (lib, features, layout, proxies, featureGate, app, ui)
  - add items: a plain \<name\>.ts(x) in the declared folder, no repo-name mark (the same name as a parent's unit = ownership unit-clash) → pnpm generate extensions
- none → /order \<direct parent\> | no means to overlay part of code → upstream exposes it by value / receptacle / split
- tell: sibling .default, or a page.tsx / frame layout.tsx 1-line switch = 1 | declaration above = 2 / 3 | placement declaration = 4 | none = cannot change
- who: `pnpm workflow ownership who <path>` answers type 1-4 | generated | own | none (ref: src/lib/forkOwnership/README.md)
- safety limits are never loosened: admin menu allowRoles narrow-only, core role enabled, profile fields, setting schema
- violations: *.default.* beside a parent's file, editing a parent's .default, plain frame.ts beside an upstream route, frame.default.ts (fails) | own .default in own area OK (middle tier too)
- upstream_no_override: upstream (Tier1) never ships a type-2 \<target\>.override.ts, not even an empty one (the config override of src/config/**, type 4, is another thing: core/ownership.md config_overrides); defaults go in the default place (pnpm check extensions)
- names_its_target: a declaration, replacement or override beside a target names its target (file name or key) | nothing changes meaning by what sits beside it
