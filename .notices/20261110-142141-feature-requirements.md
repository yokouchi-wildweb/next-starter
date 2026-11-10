# DOWNSTREAM NOTICE id:20261110-142141-feature-requirements
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T14:21:41+09:00
severity: breaking
checkpoint: config-feature-requirements
change: new declaration featureRequirements in an owner's config.ts (`export const featureRequirements = [{ key, feature, off, element? }] as const satisfies readonly FeatureRequirement[]`, literal, type from "@/featureGate"; decisions D107 D110) | read by the district map (new column featureRequirements in src/registry/district-map.jsonl) and judged by src/featureGate/checks/featureRequirements.ts: the composed value (defaults + src/config override) at key is not off while the feature is closed by rule values → fail with 2 fixes | new build gate entry `pnpm check proxies` (scripts/structure/proxies/check.ts, gate.json gates ["build"]) runs it | upstream declarations: wallet purchaseRestriction → phoneVerification (off "none"), proxies demo enabled → demoPages (off false) | wallet purchaseRestriction upstream default changed "phoneVerified" → "none"
why: a fork that left purchaseRestriction at the upstream default now gets "none" (no SMS required to buy) unless it writes "phoneVerified" | a fork with purchaseRestriction "phoneVerified" (or demo enabled true) and phoneVerification (or demoPages) closed fails `pnpm build` at pnpm check proxies
required_actions:
1. Merge upstream up to this checkpoint; `pnpm generate district-map`.
2. Decide purchaseRestriction (D107: never loosened silently). Find your old value: src/config/features/wallet.config.ts (if written) else the value before the wallet district segment (old APP_FEATURES.wallet.purchaseRestriction; the upstream default was "phoneVerified").
   - keep requiring SMS to buy: write `purchaseRestriction: "phoneVerified"` into src/config/features/wallet.config.ts and open the feature `pnpm ops features set phoneVerification on` (Firebase phone provider: docs/setup/SMS認証（電話番号認証）のセットアップ方法.md)
   - no SMS requirement: leave it (default "none") or write "none" explicitly
   [判断] oripa-do: SMS in use (phoneVerification opened by notice 20261109-221552) and wallet open → write "phoneVerified". next-vnx: wallet open and the old value "phoneVerified" made the wallet page ask for SMS before buying → keep it ("phoneVerified" + open phoneVerification) or choose "none" knowingly. boardgame-site, TriQ, 88-base: wallet closed → nothing (default "none").
3. If you set the demo proxy enabled: true in src/config/proxies/demo.config.ts, demoPages must be open (`pnpm ops features set demoPages on`).
4. Optional: declare featureRequirements in your own owners' config.ts for values that truly need a feature (not for values that are only candidates in a list).
5. `pnpm check proxies` (must pass), `pnpm typecheck`, `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`.
verify: pnpm check proxies prints "機能を要する設定の値 N 件 OK" | oripa-do / next-vnx (if kept): the wallet page asks unverified users for SMS before buying
manual_steps: -
refs: src/config/README.md「持ち主の宣言 featureRequirements」, src/featureGate/README.md「機能を要する設定の値」, src/features/core/wallet/README.md, src/lib/districtMap/README.md, council 20261023-175358-config-redesign decisions D107 D109 D110 L1.44, legate:l1 order 46
notes: since notice 20261109-221552-phone-verification-domain the wallet page does not ask for SMS while phoneVerification is closed (D52); the server enforcement of purchaseRestriction comes in a later notice (D111). | The explicit-child check (a switch you opened whose parent is closed, D121) joins pnpm check proxies in a later notice.
