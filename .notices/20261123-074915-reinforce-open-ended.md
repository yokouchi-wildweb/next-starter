# DOWNSTREAM NOTICE id:20261123-074915-reinforce-open-ended
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:f69094f5e
date: 2026-11-23T07:49:15Z
severity: info
checkpoint: reinforce-open-ended
change: pnpm workflow agent-terminal open (/reinforce) with a command watches the new tab up to 5 s for the command's end mark; when it ended at once it no longer says it opened, it prints the exit and the last screen lines (up to 8) | exit ≠ 0 → new exit code 4 (opened, but the command failed at once), exit 0 stays 0 | a plain session (no command) does not wait
why: a council or team launch that failed at once (e.g. an unknown id) was reported as opened (D443); forks get the same open and /reinforce on take-in
required_actions: none
verify: pnpm workflow agent-terminal open --socket=<private> -- sh -c 'exit 2' → prints 命令がすぐ終わりました(exit 2), exit code 4; then tmux -L <private> kill-server
manual_steps: -
refs: scripts/workflow/agent-terminal/open.mjs, scripts/workflow/agent-terminal/README.md (open), .claude/skills/reinforce/SKILL.md (STEPS 3, REPORT)
notes: /reinforce skill: exit 4 → never report it opened, show the printed lines and fix the arguments or tell the user; REPORT gains the failed-at-once form | fork follow-up: none required
