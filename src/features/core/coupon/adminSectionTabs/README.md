# adminSectionTabs(クーポン管理画面のセクションタブの受け口)

種別 enum に属さない派生クーポン画面(例: フレンドクーポン)を `/admin/coupons/<slug>` に置いたとき、全クーポン管理画面のタブの末尾に足す。
`<名前>.<fork の名前>.ts` に `export const tab: PageTabItem = { value, label, href }` を置き、`pnpm extensions:generate`。上流の項目は 0。value が core のタブと重なる項目は捨てる。
仕組み: `scripts/extensions/README.md`
