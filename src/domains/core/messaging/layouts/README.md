# layouts（レイアウトの受け口）

## Overview

レイアウト（D122）を置く受け口。`layouts/<名前>/` のフォルダ 1 つが 1 つのレイアウトで、欄の宣言・要約・送信チャンネルごとの描き方をまとめる。レイアウトの型と欄の語彙・ブロック・描き方の 3 段は lib/messaging（`src/lib/messaging/README.md`「レイアウト」）。連絡定義は `layout`（レイアウトの鍵）と `values`（欄の中身）を持ち、送る口が送信チャンネルごとに下の 3 段で描く（`services/server/sendMessage/content.ts`。管理画面の入力とプレビューも欄の宣言と描き方から。送信チャンネルは自分の欄を持たない）。お知らせ（inApp）の描き方は client の一覧（`layoutInApps`）で、受け取り箱の詳細と管理画面のお知らせのプレビューが同じ部品で描く。受け取り箱の行は要約の列とレイアウト・欄の中身を残す（`../services/server/inbox/README.md`）。なぜこの形か = `../Internals.md`。

上流のレイアウト（どれもメールとお知らせの描き方を持つ。中身は各フォルダの README）:

- `simple`（シンプル）: 件名・サムネイル・本文・リンクのボタン。管理者がテンプレートで選べる（送る画面・テンプレートの編集の最初のレイアウト = config の `initialLayout` の既定）
- `notice`（汎用）: 件名 + ブロックの並び。管理者がテンプレートで選べる
- `link`（認証のリンク）・`welcome`（ようこそ）・`statement`（明細）・`alert`（セキュリティの警告）: 定義連絡だけが使う（`adminSelectable: false`）。欄は意味で名づけ（位置の段落は使わない）、メールは前の連絡の見た目と同じ部品の並び

## Usage

フォルダの中のファイル（どれも `pnpm generate extensions` が一覧にする。並びはフォルダ名の順、鍵 = レイアウトの鍵）:

- `layout.ts`（必須）: `export const layout = defineMessageLayout({ key, label, fields, summary, adminSelectable?, disabled?, version?, revisions? })`（欄の鍵を変えたら `version` を上げ、`revisions[前の版]` に対応を書く。送信は送った版を残し、組み直しは読み替える） → server の一覧 `extensions/layouts.ts`
- `email.tsx`（任意）: `export const emailRenderer = { layout: "<鍵>", Component }` → server の一覧 `extensions/layoutEmails.ts`。`Component` は `{ values, summary, theme, unsubscribeUrl? }` を受けるメールの部品
- `inApp.tsx`（任意）: `export const inAppRenderer = { layout: "<鍵>", Component }` → client の一覧 `extensions/layoutInApps.ts`。`Component` は `{ values, summary }` を受けるお知らせの部品

その送信チャンネルの描き方が無いレイアウトは、送信チャンネルの汎用の描き方か要約で描く（描き方の 3 段、下の Internals）。

## Extension

- 見た目だけを替える: 描き方の部品を 1 行スイッチにしておく（`<部品>.tsx` = `export { <部品> } from "./<部品>.default";`、中身は `<部品>.default.tsx`）。fork は隣に `<部品>.replace.tsx` を置き、スイッチを向け替える。項目のファイル（`email.tsx` / `inApp.tsx`）はスイッチの部品を import するだけにする
- 全メールの枠（ロゴ・色・末尾、全部のメールに付ける署名・会社の住所などの共通の文もここ、D178。システムテンプレートは無い）: `src/lib/mail/frame/MailFrame.tsx` の 1 行スイッチ（既定 `MailFrame.default.tsx`）を fork の `MailFrame.replace.tsx` へ向ける（同じ export: `MAIL_FONT_FAMILY`・`MailFrame`・`MailFrameProps`）
- 上流のレイアウトの使い方を変える（型 2、宣言の `overrideOf`）: 隣に `layouts/<名前>/layout.override.ts` を置き `export const override = { disabled: true } satisfies MessageLayoutOverride;`。書けるのは `disabled`・`adminSelectable` だけ（ほかの鍵・項目の無いフォルダは `pnpm check extensions` が止める。上流は出荷しない）
  - `disabled: true`（無効）: どこにも出さない（送る画面・テンプレートの編集）。定義連絡が使えば連絡の一覧の検査（`checkMessageRegistry`）が定義とレイアウトの両方を名指して止める。このレイアウトの DB のテンプレートは一覧に「使えない」の印（`usable: false`）で並び、送る画面に出ず、送る口が 400 で断る。受け口の一覧には残る（送った記録・お知らせの行は描ける）
  - `adminSelectable`: 管理者がテンプレート・送る画面で選べるか（上流の定義連絡だけのレイアウトを選べるようにする・上流の選べるレイアウトを外す）
  - config の `initialLayout`（送る画面・テンプレートの編集の最初のレイアウト、既定 `simple`）は管理画面で選べる使えるレイアウトであること。`simple` を無効にする・選べなくする fork は `src/config/domains/messaging.config.ts` で `initialLayout` も替える（違えば連絡の一覧の検査が止める。黙ってほかに替えない）
- fork のレイアウトを足す: `layouts/<名前>/` に `layout.ts`（と `email.tsx`・`inApp.tsx`）だけを置く（受け口が許すのはこの 3 つの名前と上流の項目の `layout.override.ts`）。部品は fork の自分のドメインに置いて import する
- 送信チャンネルを足す fork は、送信チャンネルの項目に汎用の描き方か「要約から描ける」を宣言する（`channels/README.md`）。レイアウトに書き足さずに済む

## Internals

- 描き方の 3 段（D124、`resolveRendering`）: レイアウトのその送信チャンネルの描き方（この受け口の `email.tsx` / `inApp.tsx`）> 送信チャンネルの汎用の描き方（送信チャンネルの項目の `renderGeneric`）> 要約（送信チャンネルの `summaryRenderable` + `renderFromSummary`）。どれでも描けなければ「描けない（理由）」で、テンプレートの保存・プレビュー・送る前の検査が止める
- 3 つの点（`layouts`・`layoutEmails`・`layoutInApps`）は同じフォルダを files 形で読む（`*/layout.ts`・`*/email.tsx`・`*/inApp.tsx`）。server と client を分けるのは、お知らせの部品を server の一覧に混ぜないため
- `layout.override.ts` は生成の一覧 `extensions/layouts.ts` が項目に重ねる（`{ ...layout, ...override, folder }`、files の点の overrideOf: `scripts/structure/extensions/README.md`）。無効の判定は `isLayoutUsable`・選べるかは `isLayoutAdminSelectable`（lib/messaging）の 1 か所

## Verification

- `pnpm generate extensions` / `pnpm check extensions`
- `pnpm test src/lib/messaging/layout/layout.test.ts src/domains/core/messaging/channels/rendering.test.tsx`
- 無効のレイアウト・initialLayout: `pnpm test src/domains/core/messaging/services/server/sendMessage/messageRegistry.test.ts src/lib/messaging/definition.test.ts`

## Related

- `src/lib/messaging/README.md`（レイアウトの型・語彙・ブロック・解決）
- `../channels/README.md`（送信チャンネルの汎用の描き方と要約の宣言）
