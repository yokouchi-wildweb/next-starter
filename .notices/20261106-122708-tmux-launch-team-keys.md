# DOWNSTREAM NOTICE id:20261106-122708-tmux-launch-team-keys
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T12:27:08+09:00
severity: action-required
checkpoint: tmux-launch-team-keys
change: the ~/.tmux.conf block written by pnpm setup:tmux-launch now also sets tab switching and the look used by the local team tools: F1-F12 jump to a tab, Shift+Left/Right previous/next, click a tab, tabs numbered from 1 (claude = F1, the pnpm dev:tab Dev tab = F2), a two-line status bar (session name + tabs / key hints), a name plate on each tab's top border, history 50000, truecolor; colour green (colour114). All set as global defaults with -q
why: machines set up earlier keep the previous block until it is rewritten; pnpm setup:tmux-launch --check and the SessionStart hook report it as "古い"
required_actions: none
verify: pnpm test:tmux-launch passes (it loads the written ~/.tmux.conf into a private tmux server and expects no error)
manual_steps: on each machine that already ran pnpm setup:tmux-launch: run it again. A running tmux server re-reads the file at once (keys and look apply immediately); tab numbering from 1 applies to sessions opened after that
refs: scripts/tmux-launch/lib.mjs TMUX_CONF_LINES | scripts/tmux-launch/README.md「入れるもの」
notes: the settings are global defaults (-g), so tmux sessions that set their own status line or keys per session keep theirs. The shell function (claude-tmux.sh, version 2) is unchanged. The tmux-launch tests now point tmux at a temporary TMUX_TMPDIR, so test runs no longer leave socket files in /tmp/tmux-<uid>/.
