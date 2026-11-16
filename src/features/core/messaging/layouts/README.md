# layouts（ひな形の受け口）

## Overview

ひな形（D122）を置く受け口。`layouts/<名前>/` のフォルダ 1 つが 1 つのひな形で、欄の宣言・要約・経路ごとの描き方をまとめる。ひな形の型と欄の語彙・ブロック・描き方の 3 段は lib/messaging（`src/lib/messaging/README.md`「ひな形」）。今の送る口・経路の `fields` / `fieldMeta` はまだひな形を使わない（付け替えは後の区切り）。

上流のひな形（どれもメールとお知らせの描き方を持つ。中身は各フォルダの README）:

- `notice`（汎用のお知らせ）: 件名 + ブロックの並び。管理者がテンプレートで選べる
- `link`（認証のリンク）・`welcome`（ようこそ）・`statement`（お知らせの明細）・`alert`（セキュリティの警告）: コードの連絡だけが使う（`adminSelectable: false`）。欄は意味で名づけ（位置の段落は使わない）、メールは前の連絡の見た目と同じ部品の並び

## Usage

フォルダの中のファイル（どれも `pnpm generate extensions` が一覧にする。並びはフォルダ名の順、鍵 = ひな形の鍵）:

- `layout.ts`（必須）: `export const layout = defineMessageLayout({ key, label, fields, summary, adminSelectable?, revisions? })` → server の一覧 `extensions/layouts.ts`
- `email.tsx`（任意）: `export const emailRenderer = { layout: "<鍵>", Component }` → server の一覧 `extensions/layoutEmails.ts`。`Component` は `{ values, summary, theme, unsubscribeUrl? }` を受けるメールの部品
- `inApp.tsx`（任意）: `export const inAppRenderer = { layout: "<鍵>", Component }` → client の一覧 `extensions/layoutInApps.ts`。`Component` は `{ values, summary }` を受けるお知らせの部品

その経路の描き方が無いひな形は、経路の汎用の描き方か要約で描く（描き方の 3 段、下の Internals）。

## Extension

- 見た目だけを替える: 描き方の部品を 1 行スイッチにしておく（`<部品>.tsx` = `export { <部品> } from "./<部品>.default";`、中身は `<部品>.default.tsx`）。fork は隣に `<部品>.replace.tsx` を置き、スイッチを向け替える。項目のファイル（`email.tsx` / `inApp.tsx`）はスイッチの部品を import するだけにする
- 全メールの枠（ロゴ・色・末尾）: `src/lib/mail/frame/MailFrame.tsx` の 1 行スイッチ（既定 `MailFrame.default.tsx`）を fork の `MailFrame.replace.tsx` へ向ける（同じ export: `MAIL_FONT_FAMILY`・`MailFrame`・`MailFrameProps`）
- fork のひな形を足す: `layouts/<名前>/` に `layout.ts`（と `email.tsx`・`inApp.tsx`）だけを置く（受け口が許すのはこの 3 つの名前）。部品は fork の自分のドメインに置いて import する
- 経路を足す fork は、経路の項目に汎用の描き方か「要約から描ける」を宣言する（`channels/README.md`）。ひな形に書き足さずに済む

## Internals

- 描き方の 3 段（D124、`resolveRendering`）: ひな形のその経路の描き方（この受け口の `email.tsx` / `inApp.tsx`）> 経路の汎用の描き方（経路の項目の `renderGeneric`）> 要約（経路の `summaryRenderable` + `renderFromSummary`）。どれでも描けなければ「描けない（理由）」で、テンプレートの保存・プレビュー・送る前の検査が止める
- 3 つの点（`layouts`・`layoutEmails`・`layoutInApps`）は同じフォルダを files 形で読む（`*/layout.ts`・`*/email.tsx`・`*/inApp.tsx`）。server と client を分けるのは、お知らせの部品を server の一覧に混ぜないため

## Verification

- `pnpm generate extensions` / `pnpm check extensions`
- `pnpm test src/lib/messaging/layout/layout.test.ts src/features/core/messaging/channels/rendering.test.tsx`

## Related

- `src/lib/messaging/README.md`（ひな形の型・語彙・ブロック・解決）
- `../channels/README.md`（経路の汎用の描き方と要約の宣言）
