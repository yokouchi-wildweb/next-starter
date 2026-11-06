# DOWNSTREAM NOTICE id:20261106-155246-unsaved-guard-root-moved
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T15:52:46+09:00
severity: info
checkpoint: unsaved-guard-root-moved
moved: src/wiring/UnsavedGuardWiring.tsx -> src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx
change: the app-wide unsaved-guard binding (UnsavedGuardProvider + Overlays Dialog confirm + NavigationPortBridge) moved out of src/wiring into the root frame parts and was renamed UnsavedGuardWiring -> UnsavedGuardRoot; AppProviders renders it at the same place in the nest; behavior, texts and the NavigationPort shape unchanged; pnpm test:wiring passes again
why: wiring files never import each other and the file was not in the wiring catalog; the binding is a client Provider while AppProviders is server, so it sits beside AdminCommandRoot under src/app/_layout
required_actions: none
verify: pnpm test:wiring passes; pnpm typecheck passes
manual_steps: -
refs: src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx | src/wiring/AppProviders.tsx | src/wiring/README.md | order 20261106-142027-wiring-unsaved-guard-catalog
notes: UnsavedGuardWiring moved to src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx. Forks render it only through AppProviders; a fork that imported @/wiring/UnsavedGuardWiring directly switches to @/app/_layout/unsavedGuard/UnsavedGuardRoot (export UnsavedGuardRoot).
