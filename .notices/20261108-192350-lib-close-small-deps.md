# DOWNSTREAM NOTICE id:20261108-192350-lib-close-small-deps
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T19:23:50+09:00
severity: action-required
checkpoint: lib-close-small-deps
change: src/lib/userDirty (libs ["appEnv"]) and src/lib/browserStorage (libs ["errors"]) are now closed libs (package.json: exports "." only, no sideEffects; standalone tsconfig.json) | every name stays on their entries (userDirty: markUserDirty, runWithUserDirtyTracking, registerUserDirtyFlushHandler, UserDirtyFlushHandler; browserStorage: createStorageClient, localStorageClient, sessionStorageClient, save/load/removeFrom{Local,Session}Storage, useBrowserStorage, useLocalStorage, useSessionStorage, StorageClient, StorageType)
why: lint import-boundaries/lib-entry now applies to these two libs: a fork file that imports a file inside them (e.g. @/lib/userDirty/context, @/lib/browserStorage/useLocalStorage) fails pnpm lint
required_actions:
1. Merge upstream up to this checkpoint. Conflicts in src/lib/userDirty/** or src/lib/browserStorage/**: take upstream.
2. Rewrite imports to the entries: `pnpm check lib-package -- codemod` (dry-run), then `pnpm check lib-package -- codemod --apply`. Fix each stop it lists by hand (a dynamic import() of an inner file → import() of `@/lib/<name>`; others as the codemod's output says).
3. `git grep -n -E "@/lib/(userDirty|browserStorage)/" -- src scripts` must find nothing, then `pnpm typecheck` → `pnpm lint` → `pnpm check lib-package` → `pnpm build`.
verify: `pnpm check lib-package -- codemod` reports 0 statements and 0 stops; `pnpm check lib-package -- --list` shows userDirty and browserStorage as closed; `git grep -n -E "@/lib/(userDirty|browserStorage)/" -- src scripts` finds nothing; `pnpm typecheck`; `pnpm lint`; `pnpm build`
manual_steps: -
refs: src/lib/README.md 「lib を閉じる手順」, scripts/structure/lib-package/README.md, .notices/20261108-172627-shared-shelf-lib-close-base.md, order 20261108-184005-lib-close-small-deps (council 20261030-212344, shelf legate L1.32)
notes: lib-close wave 1, quest 5/5. moved: none (no file moved). imports: none for this segment (upstream read only the entries of both libs; fork-only inner paths are rewritten by the codemod).
