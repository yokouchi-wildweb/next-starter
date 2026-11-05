# DOWNSTREAM NOTICE id:20261105-131310-cron-task-override-rename
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:ui/infinite-list-retry | commit:- (this commit)
date: 2026-11-05T13:13:10+09:00
severity: action-required
checkpoint: cron-task-override-rename
change: The fork-owned cron override file is renamed src/app/api/cron/<name>/override.ts → src/app/api/cron/<name>/task.override.ts (the same `<target>.override.ts` shape as every other partial override; contents unchanged: `export const cronOverride: CronTaskOverride = { schedule?, disabled? }`). scripts/cron/discover.ts (cron:generate, cron:check incl. the build's `cron:check --vercel-build`, pnpm task) reads task.override.ts and throws on a leftover override.ts with the exact `git mv` to run. The cron special cases in scripts/extensions/overrides.mjs and src/lib/forkOwnership (unitNames / who) are gone; intake.txt now names `edit src/app/api/cron/*/task.override.ts`.
why: Until the files are renamed, cron:generate, cron:check and therefore `pnpm build` (Vercel) stop with "override.ts は旧名です". The upstream repo ships no override files, so this cannot be expressed as moved: — the rename is a mechanical step on fork-owned files.
required_actions:
1. List the old files: `git ls-files 'src/app/api/cron/*/override.ts'`. Known: boardgame-site — expire-pending-purchases, wallet-expiration-notice, wallet-expire-lots, wallet-lots-prune; pandora — analytics-rollup-daily, wallet-expire-lots, wallet-lots-prune. Other forks have none (skip to verify).
2. Rename each one without touching its contents: `for f in $(git ls-files 'src/app/api/cron/*/override.ts'); do git mv "$f" "$(dirname "$f")/task.override.ts"; done`
3. If the fork's own docs / comments mention `override.ts` for cron, update them: `git grep -n "cron.*override\.ts" -- . ':!.notices'` (leave matches that already say task.override.ts).
4. Run `pnpm cron:generate --plan <hobby|pro>` (the plan the fork already uses); vercel.json must come out unchanged (same schedules, same disabled tasks). Commit the renames together.
verify: pnpm cron:check | pnpm task --list shows "(task.override.ts)" / "[off: task.override.ts]" on the same tasks as before | git ls-files 'src/app/api/cron/*/override.ts' prints nothing | pnpm extensions:check | pnpm ownership:check
manual_steps: -
refs: scripts/cron/discover.ts, src/lib/cron/README.md (upstream のタスクを外す・時刻を変える), scripts/extensions/overrides.mjs, src/lib/forkOwnership/intake.txt, CLAUDE.md cron_wiring / downstream_owned, shelf council D171・D172, order 20261105-122328-cron-task-override-rename
notes: A middle tier that relays this should rename its own files in the same segment; a lower tier whose parent emptied an override renames the empty file the same way (empty task.override.ts = absent, as before).
