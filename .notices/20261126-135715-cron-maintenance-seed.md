# DOWNSTREAM NOTICE id:20261126-135715-cron-maintenance-seed
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:97508c456
date: 2026-11-26T13:57:15+09:00
severity: info
checkpoint: cron-maintenance-seed
change: `pnpm task --due` reads the maintenance period from the `cronMaintenance` point (the generated list @/wiring/cron through gate.plugs, item [0], none = no period), the same as the cron route (src/wiring/cronRoute.ts), instead of importing settingService directly. src/lib/seed/README.md now says what the seed runner does: a `$unique` row is looked up with `searchWithDeleted` (or `search` when the service has none), because a create with the same value as a deleted row fails the unique constraint
why: src/lib/cron/README.md (maintenance): the point is where a fork replaces or closes the judgment; a fork's own scheduler now follows it as Vercel does
required_actions: none
verify: -
manual_steps: -
refs: scripts/runner/task/run.ts (runDue), src/wiring/cronRoute.ts, src/lib/cron/README.md, src/lib/seed/README.md
notes: Fork-specific impact: not checked.
