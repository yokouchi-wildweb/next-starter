# DOWNSTREAM NOTICE id:20261106-112710-tmux-launch-conf-quiet
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T11:27:10+09:00
severity: action-required
checkpoint: tmux-launch-conf-quiet
fixes: 20261106-110435-agent-dev-server-tools
change: pnpm setup:tmux-launch writes every ~/.tmux.conf line with -q (set -gq allow-passthrough on, …), and --check / the SessionStart hook now compare the block contents, so a block written by the earlier version reports "古い" and is rewritten by pnpm setup:tmux-launch
why: allow-passthrough exists from tmux 3.3; on older tmux (e.g. 3.2a on Ubuntu 22.04) the earlier block made the tmux server print "invalid option: allow-passthrough" over the first tab when it started, hiding claude on the first launch of the day
required_actions: none
verify: pnpm test:tmux-launch passes (it loads the written ~/.tmux.conf into a private tmux server and expects no error)
manual_steps: on each machine that already ran pnpm setup:tmux-launch: run it again (pnpm setup:tmux-launch --check shows "tmux の設定: 古い" before, "入っています" after); a running tmux server re-reads the file automatically
refs: scripts/tmux-launch/lib.mjs TMUX_CONF_LINES | scripts/tmux-launch/README.md
notes: only the tmux.conf block changes; the shell function (claude-tmux.sh, version 1) and the ~/.bashrc / ~/.zshrc line are unchanged. Harm at the earlier checkpoint is a one-time error overlay on tmux < 3.3 (press q to close it), no build or data impact.
