# DOWNSTREAM NOTICE id:20261125-044757-deploy-safe-point
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-25T04:47:57+09:00
severity: info
checkpoint: deploy-safe-point
change: production deploys (pnpm live, live:all, live:room, pnpm ops room deploy) no longer stop off a safe point: they print one line where the deploy stands (✓ on a safe point, ℹ off it with the next safe point, `/flux to <sha>` or `/ship --safe`) and go on; the production confirmation and repo.json agent.deploy are unchanged | `--allow-unsafe=<reason>` is removed (no alias) | scripts/workflow/notices/safePoint.mjs deployVerdict → deployPosition (same reading, messages without 「本番に出せません」) | texts: CLAUDE.md REPO_LINK safe_point (same key: a mark, never a gate), core/notices.md ship / safe_point, the /ship --safe line, .notices/README.md セーフポイント, scripts/README.md and scripts/runner/guard/README.md say the same; a fork no longer stops /flux at a safe point before a deploy
why: a safe point is the mark of where the full checks passed, not a gate on deploying; a fork decides itself where to deploy from
required_actions:
1. drop `--allow-unsafe` wherever your own scripts, aliases, CI or docs pass it (vercel / wrangler would now receive it as an unknown flag): `git grep -n -e "--allow-unsafe" -- . ':!.notices' ':!docs/journal'`
2. your own code importing deployVerdict from scripts/workflow/notices/safePoint.mjs → rename to deployPosition (it returns the same { ok, line, message }): `git grep -n "deployVerdict" -- . ':!.notices'`
3. your own context lines that say a deploy needs a safe point or that /flux stops at one before a deploy → rewrite to the new rule or drop them: `git grep -n -i -E "safe point|セーフポイント" -- .claude/rules ':!.claude/rules/core' ':!.claude/rules/items' CLAUDE.local.md`
verify: the greps of steps 1-2 print nothing outside .notices/ and docs/journal/ | `pnpm typecheck` passes
manual_steps: -
refs: scripts/operations/deploy/lib.ts (reportSafePoint); scripts/workflow/notices/safePoint.mjs (deployPosition); CLAUDE.md REPO_LINK safe_point; .claude/rules/core/notices.md safe_point; .notices/README.md セーフポイント; scripts/runner/guard/README.md
notes: key table: no key of CLAUDE.md / core / cards renamed or removed (CLAUDE.md safe_point and core/notices.md safe_point keep their keys) | safe point making (/ship --safe, the tags, safePoint status) and /flux's position line are unchanged
