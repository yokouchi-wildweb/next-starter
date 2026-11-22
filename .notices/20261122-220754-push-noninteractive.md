# DOWNSTREAM NOTICE id:20261122-220754-push-noninteractive
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-22T13:07:54Z
severity: info
checkpoint: push-noninteractive
change: pnpm db:push without a TTY (agents, CI, < /dev/null) no longer waits forever | a statement with data loss and no --force → no y/N question: it stops with exit 1, the database unchanged, and prints the reason and the retry form `pnpm db:push -- [--env <stage>] --force` (to run after reading the SQL) | drizzle-kit's create-or-rename question → watched as pnpm db:push:check already did: on the question it prints the target, the rename candidates and the notice lines naming it, and exits 1 (no answer is chosen, the database unchanged) | on a TTY and with --force nothing changes | the watcher moved from scripts/operations/db/check-schema-roundtrip.ts to scripts/operations/db/lib.promptStop.ts (stopOnPromptWithoutTty(mode)); formatPendingPrompt takes a mode ("check" default | "push"); new pure part scripts/operations/db/lib.push.ts (dataLossStep, forceRetryCommand, dataLossStopMessage)
why: a non-interactive pnpm db:push that hit a data-loss statement sat on the y/N prompt with the DB connection open and never ended; behavior changes for tools that call it without a TTY (exit 1 with a reason instead of hanging)
required_actions: none
verify: pnpm test scripts/operations/db | `pnpm db:push < /dev/null` on a schema change that drops something prints 「TTY のない実行なので問わずに中止しました。DB は変更していません。」 and exits 1
manual_steps: -
refs: scripts/operations/db/push.ts | scripts/operations/db/lib.push.ts | scripts/operations/db/lib.promptStop.ts | scripts/operations/db/lib.pendingPrompt.ts | scripts/structure/registry/README.md Usage「スキーマ変更を DB に反映する(push)」
notes: a tool or agent that runs pnpm db:push without a TTY receives exit 1 on these two cases: hand the SQL to the human, or rerun with --force after reading it (data loss) / run pnpm db:push in a terminal to answer create or rename | no DB change, no repo.json change
