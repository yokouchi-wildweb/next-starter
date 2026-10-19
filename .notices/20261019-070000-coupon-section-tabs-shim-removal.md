# DOWNSTREAM NOTICE id:20261019-070000-coupon-section-tabs-shim-removal
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-19T07:00:00Z
severity: breaking
checkpoint: coupon-section-tabs-shim-removal
change: The re-export shim `src/app/admin/(protected)/coupons/_components/CouponSectionTabs.tsx` kept for one checkpoint by 20261019-060000 (admin-screens) is deleted. The only path is now `coupons/_screen/CouponSectionTabs.tsx`. Upstream `coupons/_components/` is empty again (downstream-only directory). Docs: the downstream recipe in src/features/core/coupon/README.md now shows a `friend-coupon/_screen/AdminFriendCouponScreen.tsx` importing `../../_screen/CouponSectionTabs`.
why: Announced in 20261019-060000 step 5. Upstream routes must not put files in `_components/`; the shim was only there so forks could close admin-screens without touching imports.
required_actions:
1. Apply 20261019-060000-admin-screens first (its checkpoint closes with the shim still present).
2. Merge upstream. If your fork EDITED the shim (it should not have), you get a modify/delete conflict: accept the deletion (`git rm`).
3. Run `pnpm tsc --noEmit`. A "Cannot find module" error naming `_components/CouponSectionTabs` is a leftover import: repoint it to `_screen/CouponSectionTabs` (from a derived-coupon Screen `coupons/<slug>/_screen/*Screen.tsx`: `../../_screen/CouponSectionTabs`; from your own `coupons/<x>/_components/*Screen.tsx`: same `../../_screen/CouponSectionTabs`).
verify: `pnpm tsc --noEmit` passes; `pnpm test:screens` passes; `grep -rn "_components/CouponSectionTabs" src` prints nothing; manual: /admin/coupons/official and a derived-coupon screen (e.g. friend-coupon) still show the section tabs in the header.
manual_steps: -
refs: .notices/20261019-060000-admin-screens.md (step 5), src/app/admin/(protected)/coupons/_screen/CouponSectionTabs.tsx, src/features/core/coupon/README.md (管理画面セクションタブの拡張)
notes: Upstream had zero imports of the old path before the deletion (only the README recipe). oripa-do already repointed its friend-coupon Screen while applying admin-screens. pandora had not applied admin-screens yet when this shipped (checked 2026-10-19); /flux closes admin-screens first, then this one, so applying them in order is safe.
