# DOWNSTREAM NOTICE id:20261103-131000-coupon-redeem-failure-recorded
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:10:00+09:00
severity: info
checkpoint: coupon-redeem-failure-recorded
resolves: 20261101-181534-coupon-redeem-failure-silent
change: completePurchase now also sets purchase_requests.coupon_redeem_failed = true when couponService.redeemWithEffect returns { success: false } (expired, limit reached, scope mismatch …), and logs the reason; before only a thrown error set it. The purchase still completes, as before
why: a discounted purchase could complete with no coupon history and no failure flag; forks that list coupon_redeem_failed rows (admin follow-up) now also see these
required_actions: none
verify: pnpm typecheck passes
manual_steps: -
refs: src/features/core/purchaseRequest/services/server/wrappers/completePurchase.ts, src/features/core/purchaseRequest/README.md
notes: no signature or column change; no db:push. Not run live (needs DB + payment flow)
