# adminSectionTabs(クーポン管理画面のセクションタブの受け口)

## Overview

- 種別 enum に属さない派生クーポン画面(例: フレンドクーポン)を `/admin/coupons/<slug>` に置いたとき、全クーポン管理画面のタブの末尾に足す受け口。上流の項目は 0
- 決まり(閉じ方)は札 `.claude/rules/items/features/coupon.md`

## Usage

- `<名前>.ts` に `export const tab: CouponSectionTabItem = { value, label, href }`(`@/domains/core/coupon/types/sectionTab`)を置き、`pnpm generate extensions`
- value が core のタブや他の項目と重なると例外
- 閉じるときは `enabled: () => boolean` を足す(false の間は一覧から外れる。省略 = 常に出す)

## Related

- 組み立てと描画: `../README.md` の Extension「管理画面セクションタブ」
- 受け口の仕組み: `scripts/structure/extensions/README.md`
