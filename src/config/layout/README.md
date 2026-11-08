# src/config/layout — 枠の上書き

枠(外枠: ヘッダー・メニュー・フッター・ナビ・サイドバー・画面全体の描き方)1 つに上書き 1 本: `<枠の名前>.config.ts`(例 `root`・`user`・`admin`)。描画専用の値は `<枠の名前>.ui.config.ts`。

- 枠の名前は各 `src/app/<範囲>/_layout/config.ts` の `frame: "<名前>"` の宣言。宣言の無い名前の上書きは `pnpm check config-overrides` が落とす
- 持ち主の既定と型は `_layout/config.ts`。ルートごとの入り切り(ヘッダー・フッター・下部メニューを出すか)は枠の設定でなく、その範囲の `frame.ts`
- 置き方・中身の決まり・1 対 1 の検査: [../README.md](../README.md)
