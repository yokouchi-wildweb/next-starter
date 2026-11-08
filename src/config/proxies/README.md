# src/config/proxies — proxies の上書き

`src/proxies`(URL の入口の判断: ドメインの無いページの公開・デモ・redirect の規則)の上書きは `proxies.config.ts` の 1 本だけ(描画専用の値は持たない)。持ち主の既定と型は `src/proxies/config.ts`。

- ドメインのあるページの公開はそのドメインの上書き(`../features/<名前>.config.ts`)に書く
- 置き方・中身の決まり・1 対 1 の検査: [../README.md](../README.md)
