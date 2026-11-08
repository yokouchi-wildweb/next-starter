# terminal features (this session runs in a tmux pane)
- own compact: `pnpm workflow agent-terminal compactSelf "<what must survive, 1-3 lines>"` → /compact is typed when this turn ends → end the turn right after | after any manual compact the session is told to continue: resume from context, approval rules unchanged
- running app: `pnpm workflow dev-tab run` (start, prints the URL) | `pnpm workflow dev-tab run stop` when the checks are done | ref: scripts/workflow/dev-tab/README.md
- good uses: long work → propose a compact at a step boundary, run pnpm workflow agent-terminal compactSelf on the user's ok | verify UI changes in the running app yourself
- ref: scripts/workflow/agent-terminal/README.md
