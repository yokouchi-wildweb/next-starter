---
paths:
  - ".notices/**"
  - ".claude/skills/ship/**"
  - ".claude/skills/flux/**"
  - "scripts/workflow/notices/**"
---
# notices
> **ROLE**: loaded when writing a downstream notice or the ship / flux tools | holds DOWNSTREAM_NOTICES detail
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

notice: an upstream change that needs downstream follow-up ships .notices/\<id\>.md in the same commit (MANDATORY also for deleting / moving a file forks may extend: moved: or the deletion in notes:) | ledger: .notices/applied/\<repo_id\>.md, each line records upstream:\<sha\> | ref: .notices/README.md
- keys: renaming / moving / removing a key of CLAUDE.md, a core file or a card → old key → new place in that notice
- index: .notices/shipped/\<repo_id\>.md = 1 line per notice this repo shipped, append-only, written by /ship from the body (never by hand) | readers (/flux, pnpm workflow ownership check, pnpm check notices) use the index + history | body never edited after shipping, deletable once its segment closed
resolves (MANDATORY when shipping an order a downstream repo filed): `resolves: <order id>` in the notice (an info notice if nothing else needs one) | forks' temporary permits on that order expire with it | /flux lists the `(order: <id>)` rule lines on it and asks whether to remove them
ship (MANDATORY): every commit + push = /ship (checks, notice, commit, push) | which kind (quick / plain / safe) and when → .claude/skills/ship/SKILL.md | prod deploys need a safe point (tag safe/\<repo_id\>/\<YYYYMMDD\>-\<n\>) | /flux = its receiving pair | fix to a shipped change → `fixes: <notice id | commit:sha>` in the fix's notice, never edit the earlier one
checkpoint (MANDATORY on every notice): `checkpoint: <label>` = default = a segment boundary the author declares (the fork is consistent there; upstream does not verify intermediate ones, the fork's /flux does) | `checkpoint: -` only when the fork cannot work without the next notice (reason in notes:) | a shipped one that does not build + an unpickable fix → `skip_checkpoint: <id>` in the fix
relay: a mid tier's /flux judges per segment by git diff whether each applied upstream notice needs relaying (ledger `relay:none` or a drafted relay notice with covers: ids) | `/flux relay` = only for legacy unjudged ids | /flux's unjudged-relay report ≠ 0 = flux not done (blocker, not a hint) | forgotten → relay in the very next commit before any other work | ref: .notices/README.md
