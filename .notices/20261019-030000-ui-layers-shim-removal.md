# DOWNSTREAM NOTICE id:20261019-030000-ui-layers-shim-removal
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-19T03:00:00Z
severity: breaking
checkpoint: ui-layers-shim-removal
change: The 49 old-path shim files kept for one checkpoint by 20261019-010000 (ui-layers-rename) are deleted, together with their directories: `wallet/components/{WalletIndexPage,WalletBalancePage,WalletHistoryPage,WalletPurchasePage}/`, `purchaseRequest/components/BankTransferInstructionPage/`, `referral/components/common/` (`InviteCodePage.tsx`, `InviteBenefitsSection.tsx` — the directory is now gone), `user/components/UserMyPage/` (incl. the barrel `index.tsx`). The `deprecated-imports/no-deprecated-path` rule stays as a mechanism, its `paths` list in `eslint.config.mjs` is now empty. Docs: must-read §8 rename record, src/lib/screens/README.md §2.
why: Announced in 20261019-010000 step 6. The new names have been in place for one checkpoint with warn-level lint listing every old import; keeping the shims longer only hides leftovers.
required_actions:
1. Merge upstream. If your fork EDITED a shim file (it should not have), you get a modify/delete conflict: accept the deletion (`git rm <path>`) and move your edit to the new path's copy in your own `_components/`.
2. If your fork still has its own entries in the `deprecated-imports` `paths` list of `eslint.config.mjs`, keep them when resolving the merge (upstream only emptied its own entries).
3. Run `pnpm tsc --noEmit`. Any "Cannot find module" error naming an old path (`.../WalletBalancePage`, `.../UserMyPage/...`, `.../common/InviteCodePage`, relative `../WalletBalancePage` etc.) is a leftover: fix it exactly like 20261019-010000 step 2 (same sed mapping; the barrel `UserMyPage` → import each container from `user/components/<Name>`).
verify: `pnpm tsc --noEmit` passes; `pnpm test:screens` passes (upstream: 148); `pnpm test:deprecated-imports` passes; `grep -rl "@deprecated 旧パス互換" src` prints nothing.
manual_steps: -
refs: .notices/20261019-010000-ui-layers-rename.md (step 2 mapping, step 6 announcement), eslint.config.mjs (deprecated-imports block), eslint-rules/deprecated-imports.mjs, docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md §8
notes: Upstream had zero imports of old paths left before the deletion (only doc mentions). Pre-existing lint errors in DummyPaymentForm / ReferralListModal / CurrencyPurchase / CurrencyDisplay / SupportedPaymentMethods are unchanged (upstream cleanup list).
