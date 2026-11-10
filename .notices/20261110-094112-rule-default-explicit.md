# DOWNSTREAM NOTICE id:20261110-094112-rule-default-explicit
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T09:41:12+09:00
severity: breaking
checkpoint: config-rule-default-explicit
change: FeatureGateRule.defaultEnabled is now required (boolean literal, decision D103); the own value is (switches.config.ts value ?? defaultEnabled) && enabled() — the "omitted = open" fallback is gone | the 20 upstream rules that omitted it now write defaultEnabled: true (same state as before; pnpm ops features list before/after: 0 differences) | rule comments and src/featureGate/README.md say "explicit, required"
why: a rule file the fork added without defaultEnabled fails pnpm typecheck (TS2741 Property 'defaultEnabled' is missing)
required_actions:
1. Merge upstream up to this checkpoint.
2. List your rule files without it: `git grep -L "defaultEnabled" -- src/featureGate/rules`. In each, add `defaultEnabled: true,` to the exported rule object (true = the state it had; write false only if you want it closed by default). [判断] oripa-do: chronoSupport, couponIssuerApplyClosed, friendCouponAdmin, friendCouponApply, inquiry, secretShop (those of them that omit it). boardgame-site: lineLogin, marketplace, signupOAuth, xLogin (those that omit it). TriQ, next-vnx, 88-base: no own rules.
3. Fork tests that set `rule.defaultEnabled = undefined` to mean open: set true instead.
4. `pnpm generate extensions`, `pnpm typecheck`, `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`.
verify: git grep -L "defaultEnabled" -- src/featureGate/rules prints nothing | pnpm typecheck | pnpm ops features list shows the same open / closed as before the merge
manual_steps: -
refs: src/featureGate/README.md「規則の書き方」「入切の値」, src/featureGate/types.ts, council 20261023-175358-config-redesign decision D103, legate:l1 order 42
notes: no behavior change upstream. Which rules Tier1 closes by default is a later notice (D115).
