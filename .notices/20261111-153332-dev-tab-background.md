# DOWNSTREAM NOTICE id:20261111-153332-dev-tab-background
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-11T15:33:32+09:00
severity: info
checkpoint: dev-tab-background
change: pnpm workflow dev-tab run can run the dev server as a detached background process (log .agent/dev-tab.log) with the same record, URL line, status and stop; chosen by --background, AGENT_TERMINAL=none or no tmux installed; exit 2 (no tmux) is gone
why: agents and team tools need to start the app where tmux is absent or a tab is not wanted; the tab path stays for tmux users
required_actions: none
verify: pnpm test scripts/workflow/dev-tab passes
manual_steps: -
refs: scripts/workflow/dev-tab/README.md (どこに立つか), scripts/workflow/dev-tab/lib.ts (decideMode, DevTabState), scripts/workflow/dev-tab/run.ts
notes: --session / --socket (a named tmux target) always opens a tab, also with AGENT_TERMINAL=none; --background with either is a usage error (exit 1). The record .agent/dev-tab.json now has mode (tab or background; a record without mode is read as a tab); a background record has pid / pgid / procStart / log instead of the tmux fields, so a reader of socket / session / windowIndex sees them only for tabs. A background start that dies before answering exits 1 with the log tail. A fork whose default.conf says AGENT_TERMINAL=none now gets a background server instead of exit 2
