# DOWNSTREAM NOTICE id:20261110-121337-featuregate-switches-write
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/outrider | commit:- (this commit)
date: 2026-11-10T12:13:37+09:00
severity: action-required
checkpoint: featuregate-switches-write
fixes: 20261109-171458-feature-gate-foundation
resolves: 20261110-104442-features-set-writes-comment, 20261110-104750-featuregate-tests-fork-switches
change: `pnpm ops features set <name> on|off` (rewriteSwitch in src/featureGate/node/setEnabled.ts) now writes only into the default export at the start of a line of src/config/featureGate/switches.config.ts; before, it wrote into the example `export default { wallet: false, sampleDomain: false }` inside the header comment and reported success while the real `export default {}` stayed empty. src/featureGate tests no longer assume the real switches file is empty outside Tier1 (dependsOn.test.ts) and restore a fork's own wallet / coupon values after the cases that change them
why: a fork that ran the command (for example per notices 20261109-221552-phone-verification-domain or 20261109-211240-fingerprint-switch-merge) may have the feature still closed although the command said it was set, and its header comment holds the values instead
required_actions:
1. look at the fork's header comment: `git grep -n "^// 例: .export default" -- src/config/featureGate/switches.config.ts`; upstream's line is exactly ``// 例: `export default { wallet: false, sampleDomain: false } satisfies FeatureSwitches;` / 書く道具: pnpm ops features set <名前> on|off``
2. if the line differs (extra names such as deviceFingerprint / fingerprintChallenge / phoneVerification, or changed values), note each name and value written there, put the line back to upstream's text, then for each noted name run `pnpm ops features set <name> on` (or `off`) so it lands in the real `export default {...}`; a name already present in the real export with the same value needs nothing
3. if the line equals upstream's, nothing to do
verify: `pnpm ops features list` shows each feature the fork meant to open as on; FEATURE_GATE_CHECK=all pnpm test src/featureGate passes; the grep of step 1 prints upstream's line
manual_steps: -
refs: src/featureGate/node/setEnabled.ts (rewriteSwitch), src/featureGate/checks/gateTools.test.ts (template-with-comment case), src/featureGate/checks/dependsOn.test.ts, orders 20261110-104442-features-set-writes-comment / 20261110-104750-featuregate-tests-fork-switches
notes: the broken writer came with 46d5d003 (notice 20261109-171458-feature-gate-foundation); forks that opened features by editing switches.config.ts by hand are not affected
