# DOWNSTREAM NOTICE id:20261124-180938-lib-userdirty-server
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261103-144009-cache-components-adoption.2 | commit:- (this commit)
date: 2026-11-24T18:09:38Z
severity: action-required
checkpoint: lib-userdirty-server
change: lib/userDirty is read only through `@/lib/userDirty/server` | it uses node's AsyncLocalStorage, and core/lib.md entry_names puts node APIs on `./server`; the `.` entry (src/lib/userDirty/index.ts) is gone and src/lib/userDirty/server.ts exports the same names (markUserDirty, runWithUserDirtyTracking, registerUserDirtyFlushHandler, type UserDirtyFlushHandler) with the same behavior; upstream's 5 callers (routeFactory createApiRoute / createDeviceRoute, purchaseRequest completePurchase, referralReward fulfillReward, couponAttributionReward grant) now import `@/lib/userDirty/server` | new README src/lib/userDirty/README.md and card .claude/rules/items/lib/userDirty.md (they write down what the code already did; no rule changed) | CLAUDE.md TOOLS build: the `pnpm generate <target>` list now names cache (domain, role, registry, routes, cron, cache, extensions, styles); no key renamed or removed
why: a node API behind the `.` entry can reach a client bundle through any client import of the lib; the same shape as lib/cacheTags and lib/audit (names on `.`, AsyncLocalStorage on `./server`)
required_actions:
1. fork code that imports `@/lib/userDirty` (a registerUserDirtyFlushHandler at startup, markUserDirty in an own write) fails to resolve until rewritten: after taking this segment, `pnpm check lib-package -- codemod --base <your commit before taking this segment>` (dry-run: it lists `@/lib/userDirty -> @/lib/userDirty/server { … }` per file), then the same with `--apply`; find: `git grep -n '"@/lib/userDirty"' -- src`
2. nothing else: the functions, their arguments and the flush behavior are unchanged
verify: `pnpm typecheck` | `git grep -n '"@/lib/userDirty"' -- src` prints nothing | `pnpm check lib-package`
manual_steps: -
refs: src/lib/userDirty/server.ts | src/lib/userDirty/README.md | .claude/rules/items/lib/userDirty.md | scripts/structure/lib-package/README.md (codemod) | CLAUDE.md TOOLS
notes: upstream rewrote its 5 callers with the same codemod (`--base` = the commit before the move); `pnpm check lib-package -- moved` gives `imports: @/lib/userDirty -> @/lib/userDirty/server`
