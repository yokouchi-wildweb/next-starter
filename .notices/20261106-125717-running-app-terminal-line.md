# DOWNSTREAM NOTICE id:20261106-125717-running-app-terminal-line
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T12:57:17+09:00
severity: info
checkpoint: running-app-terminal-line
change: upstream .claude/rules/behavior.md RUNNING_APP: the out_of_scope line drops the recon part (now only "/ship does not run scripts that need a dev server") and a new line says normal sessions usually run inside tmux (opened via pnpm setup:tmux-launch)
why: behavior.md is fork-owned; forks that copied the RUNNING_APP section may want the same two lines
required_actions: none
verify: -
manual_steps: -
refs: .claude/rules/behavior.md RUNNING_APP
notes: optional for forks: if your behavior.md has the RUNNING_APP section, replace its out_of_scope line and add the terminal line as in upstream (git show <upstream remote>/main:.claude/rules/behavior.md); if not, nothing to do.
