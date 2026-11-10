# DOWNSTREAM NOTICE id:20261110-121637-core-domain-aliases-slash-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/outrider | commit:- (this commit)
date: 2026-11-10T12:16:37+09:00
severity: action-required
checkpoint: core-domain-aliases-slash-only
fixes: 20261109-201343-core-domain-aliases
resolves: 20261110-104822-core-domain-aliases-bare-import
change: no code change upstream; this notice replaces step 2 of notice 20261109-201343-core-domain-aliases. Its sed matched with \b, so a bare import such as `from "@/features/core/userLoginEvent"` became `@/features/userLoginEvent`, but tsconfig.json only has the slash aliases `@/features/<name>/*` (no core domain has a bare alias) → TS2307 Cannot find module
why: a fork that ran that step 2 on bare imports has a broken typecheck; the rewrite must touch only the slash form
required_actions:
1. repair imports the earlier step 2 broke (bare form without core/): `git grep -n -E '@/features/(pairedDevice|taskRun|userLoginEvent)[^/A-Za-z0-9]' -- src scripts` → in each hit put core/ back: `@/features/<name>"` → `@/features/core/<name>"` (or point the import at a file under the slash form, e.g. `@/features/<name>/entities`); nothing to do when the grep prints nothing
2. (optional, replaces step 2 of 20261109-201343-core-domain-aliases) rewrite only the slash form: `git grep -lz -E '@/features/core/(pairedDevice|taskRun|userLoginEvent)/' -- src scripts ':!src/registry' | xargs -0 -r sed -i -E 's#@/features/core/(pairedDevice|taskRun|userLoginEvent)/#@/features/\1/#g'`; bare imports `@/features/core/<name>` stay as they are (src/registry is generated, never rewritten by hand)
verify: pnpm typecheck; the grep of step 1 prints nothing
manual_steps: -
refs: notice 20261109-201343-core-domain-aliases, tsconfig.json (paths: only @/features/<name>/* for core domains), order 20261110-104822-core-domain-aliases-bare-import
notes: upstream itself has no bare import of these 3 domains (git grep -E '@/features/(core/)?(pairedDevice|taskRun|userLoginEvent)[^/A-Za-z0-9]' -- src scripts = 0), so no upstream code changes. Bare aliases are not added on purpose: every core domain keeps only the slash alias
