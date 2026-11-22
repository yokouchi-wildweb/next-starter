# DOWNSTREAM NOTICE id:20261123-062436-guard-same-db-warn
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-22T21:24:36Z
severity: info
checkpoint: guard-same-db-warn
change: scripts/runner/guard resolveTarget: a production target whose DATABASE_URL is the same DB as .env.development's (host and DB name) no longer stops with exit 1 | it prints one line on stderr 「注意: 本番と開発が同じ DB(<host/db>)を指しています — 開発の作業もこの DB に書きます。分けるなら Neon のブランチ」 and goes on (D433) | unchanged: the production confirmation (TTY production / non-interactive repo.json agent.* policy and the human's one-time permit), the empty production DATABASE_URL stop, the inherited DATABASE_URL mismatch stop, db:push's data-loss question
why: the stop blocked production writes the human had allowed (a production db:push exited 1) while naming nothing it guarded beyond what the confirmation and the data-loss question already hold; behavior changes silently for a fork whose development and production env point at one DB: production writes that stopped there now run after the confirmation
required_actions: none
verify: pnpm test scripts/runner/guard
manual_steps: -
refs: scripts/runner/guard/index.ts resolveTarget | scripts/runner/guard/README.md 「注意の 1 行だけ(止めない)」 | scripts/README.md
notes: a fork that relied on this stop to keep one shared DB from production writes: split the DBs (a Neon branch for development) — the production confirmation and the permit still guard each production write
