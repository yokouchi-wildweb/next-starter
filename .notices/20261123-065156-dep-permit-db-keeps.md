# DOWNSTREAM NOTICE id:20261123-065156-dep-permit-db-keeps
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-22T21:51:56Z
severity: info
checkpoint: dep-permit-db-keeps
fixes: 20261122-215627-entry-guard
pick: -
change: scripts/runner/guard: the human's one-time permit (dep / evp) is consumed only by the deploy entries (guardDeploy: pnpm live, pnpm ops vercel env-*, room deploy / secret) | the write entries (guardEntry, incl. the production DB push `pnpm db:push -- --env production` = agent.deploy.db_entry) read it and leave it, so the `pnpm live` that follows passes on the same permit | confirmProduction returns the gate it passed (null on a TTY) and no longer consumes
why: after entry-guard a non-interactive production DB push used up `dep`, and the `pnpm live` the human allowed with it stopped (「許可がある時だけ」) — the deploy that dep was given for could not run
required_actions: none
verify: pnpm test scripts/runner/guard
manual_steps: -
refs: scripts/runner/guard/index.ts confirmProduction, guardDeploy | scripts/runner/guard/README.md 本番の確認 | scripts/workflow/devcheck/README.md
notes: your own code that calls confirmProduction directly and relied on it consuming the permit: call `.consume()` on what it returns (`git grep -n 'confirmProduction(' -- scripts ':!scripts/runner/guard'`); upstream has none
