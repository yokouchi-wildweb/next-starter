# DOWNSTREAM NOTICE id:20261106-112252-dev-tab-self-detection
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T11:22:52+09:00
severity: info
checkpoint: dev-tab-self-detection
fixes: 20261106-110435-agent-dev-server-tools
change: pnpm dev:tab no longer mistakes itself for an outside dev server: DEV_COMMAND_PATTERN matches `pnpm dev` only when followed by whitespace or end (not `dev:tab` / `dev:xxx`), and findDevProcesses skips its own process and ancestors
why: on Linux `pnpm dev:tab` always exited 3 (its own `pnpm dev:tab` process and calling shell matched the pattern), so required action 3 of the fixed notice and the RUNNING_APP flow could not start a server
required_actions: none
verify: pnpm test:dev-tab passes; `pnpm dev:tab` then `pnpm dev:tab stop` starts and stops a server when no other dev server runs in the checkout
manual_steps: -
refs: scripts/dev-tab/lib.ts | scripts/dev-tab/dev-tab.test.ts
notes: if you patched scripts/dev-tab/lib.ts locally to work around this, drop your patch and take upstream's file.
