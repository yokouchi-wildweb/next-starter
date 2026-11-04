# DOWNSTREAM NOTICE id:20261104-085017-intake-line-webhook-handlers
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T08:50:17Z
severity: info
checkpoint: intake-line-webhook-handlers
resolves: 20261101-113401-intake-line-webhook-handlers
change: No code change. Answers order 20261101-113401: the LINE webhookHandlers receptacle (src/features/core/userLineProfile/webhookHandlers/) already has intake rules, generated from its extensionPoints.ts declaration since commit 3082f92d: `add src/features/core/userLineProfile/webhookHandlers/*.{ts,tsx}` and the folder form `add .../webhookHandlers/*/**`. Every declared receptacle gets its rows the same way, and pnpm extensions:check fails when intake.txt drifts from the declarations.
why: The order asked for the missing intake rows and a check that keeps every receptacle covered; both shipped with 3082f92d (intake generated from declarations) and notice 20261103-095341-fork-name-markers-removed (plain item names). This notice only closes the order and its temporary permits.
required_actions:
1. If notice 20261103-095341-fork-name-markers-removed is already applied: nothing to do for the files (webhookHandlers/<name>.<fork_id>.ts were renamed to <name>.ts by scripts/codemods/fork-name-markers.mjs). Otherwise apply that notice first; it handles these items.
2. Remove permit rows that name this order: git grep -n "20261101-113401-intake-line-webhook-handlers" -- .fork-ownership/ ; delete each matching line from .fork-ownership/<fork_id>.permits.txt (rows listing several orders: drop only this id).
3. pnpm ownership:check
verify: pnpm ownership:check passes with no permit row naming 20261101-113401-intake-line-webhook-handlers.
manual_steps: -
refs: src/lib/forkOwnership/intake.txt (AUTO-GENERATED intake block), src/features/core/userLineProfile/extensionPoints.ts, commit 3082f92d, .notices/20261103-095341-fork-name-markers-removed.md, scripts/extensions/check.mjs
notes: Checked with the upstream intake matcher at this commit: webhookHandlers/groupJoinLog.boardlist.ts, groupMessage.boardlist.ts and groupJoinLog.ts all match `add .../webhookHandlers/*.{ts,tsx}`; a folder item webhookHandlers/<name>/index.ts matches the folder form. boardgame-site itself was not checked out or run.
