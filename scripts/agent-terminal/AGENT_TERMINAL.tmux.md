# terminal features (this session runs in a tmux pane)
- own compact: `pnpm compact:self "<what must survive, 1-3 lines>"` → /compact is typed when this turn ends → end the turn right after | after any manual compact the session is told to continue: resume from context, approval rules unchanged
- running app: `pnpm dev:tab` (start, prints the URL) | `pnpm dev:tab stop` when the checks are done | ref: scripts/dev-tab/README.md
- team leads: when the /msg command is available, `/msg <team>:<instance> <text>` reaches a lead; replies are typed into this pane
- good uses: long work → propose a compact at a step boundary, run compact:self on the user's ok | verify UI changes in the running app yourself
- ref: scripts/agent-terminal/README.md
