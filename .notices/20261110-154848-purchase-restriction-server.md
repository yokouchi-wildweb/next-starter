# DOWNSTREAM NOTICE id:20261110-154848-purchase-restriction-server
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T15:48:48+09:00
severity: action-required
checkpoint: config-purchase-restriction-server
change: walletConfig.purchaseRestriction is now enforced on the server (decision D111): initiatePurchase calls the new wallet guard assertWalletPurchaseAllowed (src/features/core/wallet/services/server/wrappers/purchaseRestriction.ts) for purchase types whose purchaseRequest type config has requiresWalletType: true (upstream wallet_topup), on create, reuse-pending and resume (resume uses the existing row's type, helper restrictedPurchaseType) | "phoneVerified" + user without phoneVerifiedAt → 403 "購入にはSMS認証が必要です"; phoneVerification closed at run time → 403 too (never loosened) | types with requiresWalletType: false (e.g. direct_sale) are never checked; completed / conflict outcomes are not checked
why: with purchaseRestriction "phoneVerified", an unverified user who starts or resumes a coin purchase now gets 403 from POST /api/wallet/purchase/initiate (before only the wallet page asked for SMS)
required_actions:
1. Merge upstream up to this checkpoint.
2. Check your value: src/config/features/wallet.config.ts purchaseRestriction (default "none", notice 20261110-142141-feature-requirements). "none" → nothing changes.
3. "phoneVerified": make sure the SMS flow works (phoneVerification open, Firebase phone provider) — unverified users must verify on the wallet page before buying. [判断] oripa-do: keeps "phoneVerified"; its direct_sale purchases (requiresWalletType false) are not affected; wallet top-ups by unverified users now get 403 until they verify. next-vnx: follows the value chosen at notice 20261110-142141. boardgame-site, TriQ, 88-base: "none" → nothing.
4. Own purchase types that credit the wallet: set requiresWalletType: true in src/config/features/purchaseRequest.config.ts so the guard covers them (the guard follows the flag, not the type name).
5. `pnpm typecheck`, `pnpm test src/features/core/wallet src/features/core/purchaseRequest`.
verify: with "phoneVerified", POST /api/wallet/purchase/initiate as an unverified user answers 403; after SMS verification it proceeds
manual_steps: -
refs: src/features/core/wallet/README.md (purchaseRestriction), src/features/core/purchaseRequest/README.md「3.1 購入開始」, council 20261023-175358-config-redesign decisions D109 D111 L1.46, legate:l1 order 48
notes: an admin changing a user's phone number still sets phoneVerifiedAt (decision D123): such users count as verified for this guard.
