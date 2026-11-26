# DOWNSTREAM NOTICE id:20261126-115838-startup-nodejs-items-guard
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261126-115404-startup-nodejs-items-guard | commit:- (this commit)
date: 2026-11-26T11:58:38+09:00
severity: action-required
checkpoint: startup-nodejs-items-guard
resolves: 20261126-115336-startup-nodejs-items-guard
change: pnpm generate extensions writes each startupTasks item of src/wiring/startup.ts whose runtime is nodejs (no runtime, or runtime: "nodejs" written literally in the item) as `load: async () => { if (process.env.NEXT_RUNTIME === "nodejs") return import("<item>").then((m) => m.task); return { name: "<item>", runtime: "nodejs", run: () => {} }; }` — the same guard as the backend status lines; items with runtime "edge" / "both" are unchanged | new declaration key runtimeGuard: true (lazy plugs points only), set on src/lib/startup's startupTasks
why: after 20261126-090548-startup-status-nodejs-only a fork's own nodejs item (e.g. userDirtyFlush → … → crypto.randomUUID) was still imported outside the guard, so the Edge instrumentation bundle pulled it in and pnpm dev warned (crypto / node:crypto in the Edge Runtime)
required_actions:
1. Merge upstream up to this checkpoint, then `pnpm generate extensions` (src/wiring/startup.ts is generated; a conflict there is resolved by regenerating, never by hand).
2. Each of your items under <domain or lib>/plugs/startupTasks/ that runs on edge too writes its runtime as a literal in the exported task (`runtime: "both"` or `runtime: "edge"`): the generator reads the literal; a runtime given through a variable is read as nodejs and the item no longer runs on edge. Find them: `git grep -n "runtime" -- 'src/**/plugs/startupTasks/**'`.
verify: `git grep -n 'NEXT_RUNTIME' -- src/wiring/startup.ts` shows a guard on every nodejs item line | pnpm dev starts without the Edge Runtime crypto warning and your items still log on Node | pnpm check extensions passes
manual_steps: -
refs: scripts/structure/extensions/extensions.mjs (renderPlugsPoint, runtimeOf) | scripts/structure/extensions/README.md (宣言のキー runtimeGuard) | src/lib/districtMap/declarations.mjs | src/lib/startup/extensionPoints.ts, src/lib/startup/README.md | notice 20261126-090548-startup-status-nodejs-only | order 20261126-115336-startup-nodejs-items-guard
notes: Tier1 ships no startupTasks item, so src/wiring/startup.ts does not change here (only a fork with items gets new lines) | the item's own rule stays: no Node-only import at the top of the item file (src/lib/startup/README.md); the guard keeps the edge bundle clean even when an item's imports reach one | serverErrorReporters (also read by instrumentation) is not guarded by this change
