# DOWNSTREAM NOTICE id:20261106-121228-tmux-launch-close-ends
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T12:12:28+09:00
severity: action-required
checkpoint: tmux-launch-close-ends
change: the tmux-launch shell function (claude-tmux.sh, version 2) opens one tmux session per `claude` (<repo>, then <repo>-2, -3 …) with destroy-unattached on, so closing the terminal ends the session, claude and the Dev tab's server, like a plain terminal tab; before, closing left them running in the background and a second `claude` in the same repo joined the same session
why: machines set up with pnpm setup:tmux-launch keep the version 1 copy until it is reinstalled; the SessionStart hook reports it as "古い"
required_actions: none
verify: pnpm test:tmux-launch passes (it opens claude in a real tmux through a pseudo terminal, hangs the terminal up and expects claude and the session gone)
manual_steps: on each machine that already ran pnpm setup:tmux-launch: run it again (pnpm setup:tmux-launch --check shows "中身: 版 1(リポの版 2) → 古い" before). tmux sessions opened before that keep the old behavior until they end
refs: scripts/tmux-launch/claude-tmux.sh | scripts/tmux-launch/README.md「claude を打ったとき」
notes: a closed session can be resumed with `claude --continue` (the transcript stays). No change to the ~/.bashrc / ~/.zshrc line or the ~/.tmux.conf block.
