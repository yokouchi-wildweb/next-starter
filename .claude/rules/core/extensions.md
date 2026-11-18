---
paths:
  - "src/app/**/_screen/**"
  - "src/app/**/_layout/**"
  - "src/app/**/_components/**"
  - "src/features/core/**"
---
# extensions
> **ROLE**: loaded when copying or composing a parent's parts | holds FORK_EXTENSION (judge, guards, want → means, copy and own marks)
> Tier1-owned: forks never edit (gap → /order <direct parent>)

> an older CLAUDE.md in a fork that differs → this file wins | old core_domain_ui_boundary ("core is data layer only") is gone

judge: first match, by what the copy would hold | never by line count or area name
1. a public means gives the result → use it (want → means below)
2. the copy holds only looks and layout, visual state included (open, hover) → copy, line 1 = the mark
3. the copy holds unchanged behavior (form state, submit, effect logic, query, route, server logic) or a guard, or no means exists → /order the direct parent + temporary permit | upstream splits the part or adds a receptacle | writing your own part from scratch instead stays allowed (own_mark)

not a copy (free): a new feature | a part of your own written from scratch (own_mark below) | calling public services, hooks, Factories | a fork route declaring guards on a Factory | calling walletService | a new sign-in method
guards: access, rateLimit, recaptcha, session cookie, token issuing, balance or payment writes | a copy holding one is not allowed, auth screens' text and looks are normal

want → means:
- text, link, number, flag, color, icon, option list → config | per-call value → value prop | prop missing → /order
- add a step to a process → receptacle item (extensionPoints.ts) | replace the single implementation → 1-line switch
- change looks or layout → compose core parts in _components/, else copy (judge 2) | add a form input → formInputs item
- stop a page → close its feature (pnpm ops features set \<name\> off) | stop an added role → enabled:false | new feature → own route + domain

order: an extension request carries `tried: <means checked — why not enough>`
copy_mark: line 1 `// copied-from: <upstream path>` | no sha, no ledger | unmarked copies are undetectable and accepted | /flux lists changed origins per segment, never stops
- backfill: when a fork takes in this policy, it marks once the existing copies it knows it made | no check, /flux never stops on it | copies it does not know of stay unmarked (undetectable)
own_mark (optional): a file a fork built instead of an upstream part → line 1 `// instead-of: <upstream entry> ; why: lacks <what>|looks|business ; order: <order id>|-` | no check, upstream never reads fork marks | /flux lists the marks whose entry changed per segment, never stops | an order shipped as resolves: → marks with that order id are replacement candidates
- kept_behavior_copy: an existing copy holding behavior (judge 3) stays, marked, while its split order is open | replace it with the public hook when that ships
