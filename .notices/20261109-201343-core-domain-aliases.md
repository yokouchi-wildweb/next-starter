# DOWNSTREAM NOTICE id:20261109-201343-core-domain-aliases
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/outrider | commit:- (this commit)
date: 2026-11-09T20:13:43+09:00
severity: info
checkpoint: core-domain-aliases
change: tsconfig.json adds the path aliases @/features/pairedDevice/*, @/features/taskRun/*, @/features/userLoginEvent/* (→ src/features/core/<name>/*) and drops the dead @/features/insane/* alias; upstream imports of these 3 domains now omit core/
why: CLAUDE.md DOMAINS says imports of core domains omit core/; these 3 lacked the alias, so code imported @/features/core/<name>/... Fork code that still imports @/features/core/<name>/... keeps working through @/* → src/*, so following is optional
required_actions:
1. (optional) find the fork's own files that import the long form: `git grep -l -E '@/features/core/(pairedDevice|taskRun|userLoginEvent)\b' -- src scripts ':!src/registry'`
2. (optional) rewrite them in place: `git grep -lz -E '@/features/core/(pairedDevice|taskRun|userLoginEvent)\b' -- src scripts ':!src/registry' | xargs -0 -r sed -i -E 's#@/features/core/(pairedDevice|taskRun|userLoginEvent)\b#@/features/\1#g'` (upstream-owned files already come rewritten with the merge; touch only fork-owned files)
3. if the fork's tsconfig.json keeps its own copy of the paths block (conflict on merge), keep upstream's lines: the 3 new aliases present and no @/features/insane/* line
verify: pnpm typecheck; the grep of step 1 prints nothing (only when steps 1-2 were taken)
manual_steps: -
refs: tsconfig.json | CLAUDE.md DOMAINS | order 20261109-200406-closing1-tsconfig-aliases
notes: src/registry/*.ts are generated (pnpm generate registry) and keep the @/features/core/<name> form for every core domain: never rewrite them by hand (pnpm check registry fails). File paths written without @/ (comments, eslint.config.mjs globs, test fixtures) are paths, not imports, and stay as they are
