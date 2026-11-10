# DOWNSTREAM NOTICE id:20261110-153418-feature-gate-l3-switch-write
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/nomad | commit:- (this commit)
date: 2026-11-10T15:34:18+09:00
severity: action-required
checkpoint: feature-gate-l3-switch-write
fixes: 20261109-171458-feature-gate-foundation
resolves: 20261110-132442-feature-gate-l3-codemod-switch-write
change: codemod .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.mjs (writeSwitch) now writes only into the default export at the start of a line of src/config/featureGate/switches.config.ts; before, it wrote into the example `export default { wallet: false, sampleDomain: false }` inside the header comment and reported success while the real `export default {}` stayed empty
why: a fork that ran the codemod with --apply may have its feature switches (values carried over from the old config) written into the header comment, so those features silently fall back to their rule's defaultEnabled
required_actions:
1. not yet run the codemod of 20261109-171458-feature-gate-foundation → nothing to do here (run it as that notice says; this commit's version writes to the right place)
2. already ran it: look at the header comment: `git grep -n "^// 例: .export default" -- src/config/featureGate/switches.config.ts`; upstream's line is exactly ``// 例: `export default { wallet: false, sampleDomain: false } satisfies FeatureSwitches;` / 書く道具: pnpm ops features set <名前> on|off``
3. if the line differs (names or values the codemod added), note each name and value written there, put the line back to upstream's text, then write each noted `<name>: <value>` by hand into the real `export default { ... } satisfies FeatureSwitches;` (a name already there with the same value needs nothing)
4. if the line equals upstream's, nothing to do
verify: the grep of step 2 prints upstream's line | `pnpm test .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.test.mjs` passes | pnpm typecheck passes
manual_steps: -
refs: .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.mjs (writeSwitch) and its .test.mjs (template-comment cases), notice 20261110-121337-featuregate-switches-write (same fix for pnpm ops features set), order 20261110-132442-feature-gate-l3-codemod-switch-write
notes: the broken writer came with 5f640b8d2 (notice 20261109-171458-feature-gate-foundation) | step 3 says to edit by hand because `pnpm ops features set` had the same bug until notice 20261110-121337-featuregate-switches-write; after taking that notice the command may be used instead | the recovery check is the same as 20261110-121337's, so a fork that already did that one has nothing more to do
