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
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

core (approval required): CLAUDE.md, .claude/rules/core/, src/features/core/, src/components/, src/proxy.ts, src/proxies/ + src/featureGate/ (files the fork added = fork-owned, extensions/ = generated), scripts/structure/domain/, src/styles/core/**, src/styles/README.md, servers/room/src/core/, servers/room/src/index.ts, src/wiring/ (files the fork added = fork-owned)
- routes and libs: src/app/**/{_screen,_layout}/** of upstream routes (\<name\>.replace files beside them = fork-owned) | src/lib/ libs in upstream sections of src/lib/CATALOG.md (fork-added libs = fork-owned)
downstream_owned (upstream never edits after creation): root src/styles/*.css (entry global.css, palette / typography / overrides.css, gradient.css = pnpm generate styles output of config/app/gradients.config.ts), src/config/ui/*.config.ts, page.tsx / frame layout.tsx of switched routes, _components/** and \<name\>.replace files of upstream routes, \<target\>.override.ts (cron: task.override.ts)
- full list of the places a fork may write in upstream files (intake points) = src/lib/forkOwnership/intake.txt (kinds: edit / add / region / marker / append / generated / debt / self) | src/config/** = an intake point too (the fork may edit it; upstream edits it as well, rules: config below)
config: src/config/ = values only (logic → domain utils or lib) | value changes OK | structure changes (add/remove keys, type change, rename) need approval
fork_ownership (check: pnpm workflow ownership check, run by /flux after each segment commit and before its push | fails from the start | exit 2 = unverified, never a pass | ref: src/lib/forkOwnership/README.md):
- base = merge-base with the direct parent | files the fork added = fork-owned | files in the base = parent-owned: write only inside intake points, never delete / move / rename them (a `_` prefix rename too) | adding a file inside an ancestor's lib, or under src/features/core/ or src/featureGate/ outside a receptacle = violation
- multi-tier: strict only for files in the Tier1 version (walked from the ledger's upstream:\<sha\> to the version without .notices/applied) | files a middle tier added may be edited / deleted / renamed below it | fork name = `repo_id` in repo.json at the repo root (every repo, with `tier`; ledger, permits, CATALOG heading use it; write: pnpm workflow repo-json)
- unused upstream page → close its feature (pnpm ops features set \<name\> off → src/config/featureGate/switches.config.ts) | unused role → enabled:false | replacement allowed by FORK_EXTENSION → _components/ under a new name, 1-line switch in page.tsx
- edit outside the intake: an intake point exists → move there | none (incl. upstream bug / perf / security fixes) → /order <direct parent> + temporary permit in .fork-ownership/\<fork name\>.permits.txt (≥1 order id; expires when all its orders ship as resolves: or the parent touches the file) | debt rows of intake.txt → permit with that row's order id
fork_core_edit_compat (while a permit lets a fork edit a core path; upstream's own breaking change → notice is a separate rule, see core_ui):
- stay backward compatible with upstream callers: props/args the fork adds = optional with an empty default | never delete core code the fork does not use | signature change = add a new name, keep the old
- why: upstream `_screen/*` Screens stay in the fork's tsc scope even when its page.tsx points to `_components/` → an incompatible core edit fails tsc at the next merge | fix the fork's edit, never the upstream Screen | ref: src/lib/screens/README.md §7
