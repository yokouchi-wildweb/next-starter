---
paths:
  - "repo.json"
  - "src/lib/forkOwnership/**"
  - "src/lib/CATALOG.md"
  - ".claude/rules/lineage.md"
  - ".fork-ownership/**"
---
# ownership
> **ROLE**: loaded when writing ownership data (repo.json, permits, ledger, CATALOG.md, lineage.md, the ownership lib) | holds who owns what (CORE_FILES, fork_ownership)
> Tier1-owned: forks never edit (gap → /order next-starter)

core (= CORE, approval required): CLAUDE.md, core/ (.claude/rules/core/), src/features/core/ (core domains, core roles), src/styles/core/**, src/styles/README.md, src/components/, src/proxy.ts, src/proxies/ + src/featureGate/ (files a fork added = fork-owned, extensions/ = generated), scripts/structure/domain/ | per path → pnpm workflow ownership who
- servers and wiring: servers/room/src/core/, servers/room/src/index.ts, src/wiring/ (files a fork added = fork-owned)
- routes and libs: src/app/**/{_screen,_layout}/** of upstream routes (\<name\>.replace files beside them = fork-owned) | libs in the Tier1 section of src/lib/CATALOG.md (libs a fork added = fork-owned)
downstream_owned (upstream never edits after creation): root src/styles/*.css (entry global.css, palette / typography / overrides.css, gradient.css = pnpm generate styles output of config/lib/gradient.config.ts), page.tsx / frame layout.tsx of switched routes, _components/** and \<name\>.replace files of upstream routes, \<target\>.override.ts (cron: task.override.ts)
- not downstream-owned: a generated admin route's hand-owned _components/ = the domain owner's (core/generated.md)
intake: every place a fork may write in parent files = src/lib/forkOwnership/intake.txt (kinds: edit / add / region / marker / append / generated / debt / self) | src/config/** = an intake point too (the fork may edit it; upstream edits it as well, rules: config below)
config: src/config/ = values, or a zero-arg function that only returns env (process.env.X joined with ?? / ||) (logic → domain utils or lib) | value changes OK | structure changes (add/remove keys, type change, rename) need approval
- config_overrides: one config override (src/config/**/\<name\>.config.ts, type 4; not a type-2 .override.ts) per owner, 1:1 (pnpm check config-overrides) | upstream ships the owner's config.ts and its empty override in the same commit, and deletes / renames them together
- override files: values = literals, the allowed reads, or a zero-arg arrow that only returns env (`() => process.env.X`, joined with ?? / ||) (lint config-overrides/literal-only) | only the owner reads its override (lint config-overrides/owner-reads-only) | upstream has no src/config/app/ or ui/ (a fork's leftover file there moves to its owner: src/config/README.md) | ref: src/config/README.md
fork_ownership (check: pnpm workflow ownership check, run by /flux after each segment commit and before its push | fails from the start | exit 2 = unverified, never a pass | ref: src/lib/forkOwnership/README.md):
- base = merge-base with the direct parent | files the fork added = fork-owned | files in the base = parent-owned: write only inside intake points, never delete / move / rename them (a `_` prefix rename too)
  - adding a file inside an upstream unit (a folder unit directly under a src/components/\<Category\>, src/hooks or src/utils, an ancestor's lib), or under src/features/core/, src/featureGate/ or core/, outside a receptacle or a declared override place (intake.txt add / edit rows, e.g. src/featureGate/rules/, domainEntry.override.ts) = violation
  - shelf: a new unit directly under a category, a new hooks / utils file, a new lib, a new category = fork-owned | a unit with an upstream unit's name (file ↔ folder, x.ts ↔ x.tsx) = reported as unit-clash
- multi-tier: strict only for files in the Tier1 version (walked from the ledger's upstream:\<sha\> to the version without .notices/applied) | files a middle tier added may be edited / deleted / renamed below it, except an ancestor's .default and .claude/rules/service/
- names: each repo's name = `repo_id` in repo.json at the repo root (with `tier`; ledger, permits, CATALOG heading use it; written only by pnpm workflow repo-json)
- unused upstream page → close its feature (pnpm ops features set \<name\> off → src/config/featureGate/switches.config.ts) | unused added role → enabled:false (core roles stay on) | replacement allowed by FORK_EXTENSION → a Screen in _components/ (screens.md route), 1-line switch in page.tsx
- edit outside the intake: an intake point exists → move there | none (incl. upstream bug / perf / security fixes) → /order <direct parent> + temporary permit in .fork-ownership/\<repo_id\>.permits.txt (≥1 order id; expires when all its orders ship as resolves: or the parent touches the file) | debt rows of intake.txt → permit with that row's order id
fork_core_edit_compat (while a permit lets a fork edit a parent-owned file; a parent's own breaking change → notice: screens.md contracts, notices.md):
- stay compatible with the parent's callers: props/args the fork adds = optional with an empty default | never delete parent code the fork does not use | never change a name or an argument shape: a needed change → /order <direct parent> (the parent renames as screens.md contracts says)
- why: the parent's `_screen/*` Screens stay in the fork's tsc scope even when its page.tsx points to `_components/` → an incompatible edit fails tsc at the next merge | fix the fork's edit, never the parent's Screen | ref: src/lib/screens/README.md Usage
