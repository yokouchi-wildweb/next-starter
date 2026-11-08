# adminSectionTabs(クーポン管理画面のセクションタブの受け口)

種別 enum に属さない派生クーポン画面(例: フレンドクーポン)を `/admin/coupons/<slug>` に置いたとき、全クーポン管理画面のタブの末尾に足す。
`<名前>.ts` に `export const tab: CouponSectionTabItem = { value, label, href }`(`@/features/core/coupon/types/sectionTab`)を置き、`pnpm generate extensions`。上流の項目は 0。value が core のタブや他の項目と重なると例外。
閉じるときは `enabled: () => boolean` を足す(false の間は一覧から外れる。省略 = 常に出す。client で読める値だけを見る)。`className: "hidden"` では隠さない。
仕組み: `scripts/structure/extensions/README.md`
