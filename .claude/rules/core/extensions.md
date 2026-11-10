---
paths:
  - "src/app/**/_screen/**"
  - "src/app/**/_layout/**"
  - "src/**/extensionPoints*.ts"
  - "src/lib/forkOwnership/**"
---
# FORK_EXTENSION procedure
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies
> an older CLAUDE.md in a fork that differs → this file wins | old core_domain_ui_boundary ("core is data layer only") is gone

judge: first match, by what the copy would hold | never by line count or area name
1. a public means gives the result → use it (want → means below)
2. the copy holds only looks and layout, visual state included (open, hover) → copy, line 1 = the mark
3. it holds unchanged behavior (form state, submit, effect logic, query, route, server logic) or a guard, or no means exists → /order the direct parent + temporary permit | upstream splits the part or adds a receptacle

not a copy (free): a new feature | calling public services, hooks, Factories | a fork route declaring guards on a Factory | calling walletService | a new sign-in method
guards: access, rateLimit, recaptcha, session cookie, token issuing, balance or payment writes | a copy holding one is not allowed, auth screens' text and looks are normal

want → means:
- text, link, number, flag, color, icon, option list → config | per-call value → value prop | prop missing → /order
- add a step to a process → receptacle item (extensionPoints.ts) | replace the single implementation → 1-line switch
- change looks or layout → compose core parts in _components/, else copy (judge 2) | add a form input → formInputs item
- stop a page → close its feature (pnpm ops features set \<name\> off) | stop a role → enabled:false | new feature → own route + domain

change_types (the only 4 ways to change an upstream thing | marks = .default / .replace / .override, upstream files are plain | table → scripts/structure/extensions/README.md「4 つの型」):
- 1 whole (code): \<name\>.default + plain 1-line switch → fork \<name\>.replace, repoint the switch | screens: page.tsx switch, default _screen/ → fork _components/\<X\>Screen.tsx | frame: layout.tsx switch → fork _layout/\<Layout\>.replace.tsx beside the default (fork frame parts → route's _components/, plain names)
- 2 overlay (data): plain target + declared keys (overrideOf / overrides) → fork \<target\>.override.ts, declared keys only | frame: creator frame.ts → lower repo frame.override.ts
- 3 add: plain new name in a declared receptacle folder | 4 placement (values): src/styles/core/\<name\>.css → src/styles/\<name\>.css, owner config.ts → src/config/{lib,features,layout,proxies}/\<name\>.config.ts
- none → /order \<direct parent\> | no means to overlay part of code → upstream exposes it by value / receptacle / split
- tell: sibling .default = 1 | declaration above = 2 / 3 | placement declaration = 4 | none = cannot change
- who: `pnpm workflow ownership who <path>` answers type 1-4 | generated | own | none (ref: src/lib/forkOwnership/README.md)
- safety limits are never loosened: admin menu allowRoles narrow-only, core role enabled, profile fields, setting schema
- violations: *.default.* beside a parent's file, editing a parent's .default, plain frame.ts beside an upstream route, frame.default.ts (fails) | own .default in own area OK (middle tier too)

order: an extension request carries `tried: <means checked — why not enough>`
copy_mark: line 1 `// copied-from: <upstream path>` | no sha, no ledger | unmarked copies are undetectable and accepted | /flux lists changed origins per segment, never stops
- backfill: when a fork takes in this policy, it marks once the existing copies it knows it made | no check, /flux never stops on it | copies it does not know of stay unmarked (undetectable)
- kept_behavior_copy: an existing copy holding behavior (judge 3) stays, marked, while its split order is open | replace it with the public hook when that ships

receptacle limits (upstream):
- only for a request with a feature that really uses it, whatever the fork count
- order: existing means → value or part split → new receptacle | existing kinds only, a new kind goes to the council
- must not bypass a guard | named ReactNode stays banned in core
- same commit: README (timing, tx, on failure) + test + intake line
