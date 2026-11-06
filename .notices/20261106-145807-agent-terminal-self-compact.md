# DOWNSTREAM NOTICE id:20261106-145807-agent-terminal-self-compact
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T14:58:07+09:00
severity: info
checkpoint: agent-terminal-self-compact
change: new scripts/agent-terminal/ (switch AGENT_TERMINAL=tmux|none, read from process env then scripts/agent-terminal/default.conf = tmux; missing / unknown = none): `pnpm compact:self "<focus>"` queues the agent's own /compact into its tmux pane when the turn ends (elsewhere it prints the /compact line for the user); after a manual /compact in a tmux session 「続けてください」 is typed so the session resumes; SessionStart prints AGENT_TERMINAL.tmux.md (what the agent can do there) only inside tmux; .claude/settings.json gains SessionStart / UserPromptSubmit / Stop / PreCompact hooks (silent elsewhere); coffee-break shortcut now runs compact:self
why: sessions of a fork running claude inside tmux now get the terminal guide in context and an automatic 「続けてください」 after a manual /compact; outside tmux nothing changes
required_actions: none
verify: pnpm test:agent-terminal passes
manual_steps: -
refs: scripts/agent-terminal/README.md | .claude/settings.json | .claude/rules/shortcuts.md coffee-break | order 20261106-143827-session-self-compact-and-auto-continue
notes: a person who does not want it sets `export AGENT_TERMINAL=none` in their shell (hooks and scripts do not read Next's .env files). Typing happens only into an empty input box of the same conversation; state lives in ${XDG_STATE_HOME:-~/.local/state}/next-starter/agent-terminal/. Team-tool tabs (TK_TEAM etc.) are left alone.
