# DOWNSTREAM NOTICE id:20261125-104512-env-production-sync
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:bcaccfcf2
date: 2026-11-25T10:45:12+09:00
severity: action-required
checkpoint: env-production-sync
change: Production env keys stay in step with .env.production: (1) `pnpm ops vercel env-add <name> production`, after Vercel accepted it, writes the same value into the checkout's .env.production (replaces the line of that name, else appends; values with spaces, #, or quotes are quoted); env-rm and env-pull leave the file alone. (2) `pnpm live` / `pnpm live:all`, when the app goes to production, after the deploy guard and before deploying, adds every non-empty .env.production key that `vercel env ls production` lacks (names starting VERCEL_ excluded) with its .env.production value, printing each name; it never overwrites or removes, and a failed add (or an unreadable name list) stops the deploy; preview deploys do nothing. (3) env-add / env-rm / env-pull to development or preview no longer read agent.env_production or need /allow evp (production unchanged). No repo.json key is added. Docs: scripts/operations/vercel/README.md, the /vercel skill, core/scripts.md (env files: hosting), docs/setup.
why: no path wrote a key to both places, so after the production build stopped reading the uploaded .env.production (notice 20261124-131846-deploy-no-env-files) keys present only in the file were missing in production
required_actions:
1. Before the next production `pnpm live`: list `pnpm ops vercel env-ls production` and the non-empty keys of .env.production; every key in the file that Vercel's production lacks will be added by the deploy with the file's value → make sure each holds the production value (or empty it / add the right value with `pnpm ops vercel env-add <name> production` first).
2. If the fork's own context (.claude/rules outside core, its skills) says development / preview env writes need /allow evp or agent.env_production, rewrite those lines: only production needs them now.
verify: `pnpm ops vercel env-add <name> development` runs without /allow evp; a production `pnpm live` prints `env の揃え:` lines before the deploy
manual_steps: -
refs: scripts/operations/vercel/lib.vercel.mjs (syncProductionEnv, writeEnvValue, prepareVercel), scripts/operations/deploy/lib.ts (syncEnv), scripts/operations/vercel/README.md, .claude/skills/vercel/SKILL.md, .claude/rules/core/scripts.md
notes: A fork without .env.production or not deploying to Vercel sees no change. The values never go on screen or into arguments (stdin). Fork-specific impact: not checked.
