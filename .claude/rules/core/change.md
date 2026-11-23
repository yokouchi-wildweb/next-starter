---
paths:
  - "src/config/**"
  - "src/business/**"
  - "src/styles/*.css"
  - "**/*.override.*"
  - "**/*.replace*"
  - "**/*.default*"
  - "src/app/**/{_components/**,_layout/**,frame*.ts,favicon.ico}"
  - "src/lib/forkOwnership/intake.txt"
---
# change
> **ROLE**: loaded when writing a place a lower repo may change (config, own styles, .override / .replace / .default, _components) | holds the change types (CHANGE_TYPES)
> Tier1-owned: forks never edit (gap → /order next-starter)

change_types (the only 5 ways to change what a parent owns | marks = .default / .replace / .override, upstream files are plain | table → scripts/structure/extensions/README.md Extension):
- 1 replace (whole code): \<name\>.default + plain 1-line switch → fork \<name\>.replace, repoint the switch | screens carry no mark: the page.tsx 1-line switch is the declaration, default _screen/ → fork plain _components/\<X\>Screen.tsx | frame: layout.tsx switch → fork _layout/\<Layout\>.replace.tsx beside the default (fork frame parts → route's _components/, plain names)
- 2 override (data): plain target + declared keys (overrideOf / overrides) → fork \<target\>.override.ts, declared keys only | frame: creator frame.ts → lower repo frame.override.ts
- 3 add: an item in the plugging side's own plugs/\<point\>/ (your domain or lib) | 4 counterpart (values): src/styles/core/\<name\>.css → src/styles/\<name\>.css, owner config.ts → src/config/\<area\>/\<name\>.config.ts (lib, domains, frame, proxies, featureGate)
  - add items: a plain \<name\>.ts(x) (or \<name\>/index.ts(x)) under \<domain\>/plugs/\<point\>/ of your own domain or lib, never inside an upstream domain or lib, no repo-name mark → pnpm generate extensions (items are told apart by \<domain\>/\<name\>)
- 5 self: the self files each repo writes its own version of (.claude/rules/project.md, .claude/rules/behavior.md, repo.json, vercel.json) | using the parent's version as is is a valid choice | a take-in that drops your own lines → /flux asks: follow the parent's version / restore your lines (pnpm workflow ownership check never fails on it) → core/design.md self_files
  - vercel.json: only a repo that deploys to Vercel holds it (none is right) | crons = pnpm generate cron output → core/design.md self_files
  - porting: /flux shows the parent's diff once per segment → port by hand, in a separate commit, only what fits this repo | a self file holds only what describes this repo, never a rule a lower repo must follow
  - upstream side: nothing to declare, the list of self files is closed (intake.txt kind self) and only Tier1 extends it | a new repo.json key gets a reader default, a required one ships a notice + migration tool
- none → /order \<direct parent\> | no means to override part of code → upstream exposes it by value / receptacle / split
- tell: sibling .default, or a page.tsx / frame layout.tsx 1-line switch = 1 | a point declared in the district's extensionPoints.ts or its kind's row of src/lib/districtMap/kinds.mjs (KINDS) = its type 2 / 3 / 4 | none = cannot change
- who: `pnpm workflow ownership who <path>` answers type 1-5 | generated | own | none (ref: src/lib/forkOwnership/README.md)
- safety limits are never loosened: admin menu allowRoles narrow-only, core role enabled, profile fields, setting schema
- violations: *.default.* beside a parent's file, editing a parent's .default, plain frame.ts beside an upstream route, frame.default.ts (fails) | own .default in own area OK (middle tier too)
- upstream_no_override: upstream (Tier1) never ships a type-2 \<target\>.override.ts, not even an empty one (the config values file of src/config/**, type 4, is another thing: core/ownership.md config_values); defaults go in the default place (pnpm check extensions)
- names_its_target: a declaration, replacement or override beside a target names its target (file name or key) | nothing changes meaning by what sits beside it
