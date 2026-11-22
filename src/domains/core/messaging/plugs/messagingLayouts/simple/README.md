# simple（上流のレイアウト「シンプル」）

## Overview

件名・サムネイル・本文・リンクのボタンだけの短いお知らせのレイアウト（D119）。管理者がテンプレートで選べる（`adminSelectable: true`）。送る画面・テンプレートの編集の最初のレイアウト（config の `initialLayout` の既定）。ブロックを並べるリッチな形は `notice`。受け口の仕組みは `../README.md`、型と語彙は `src/lib/messaging/README.md`「レイアウト」。

## Usage

- 欄: `subject`（1行テキスト、メールを送る時だけ必須 `requiredFor: ["email"]`）・`image`（画像 = サムネイル、任意）・`body`（段落、必須）・`link`（ボタン `{ label, url }`、任意）。任意の欄の空（画像の空文字・文言も URL も空のボタン）は「無い」= 描かない。ボタンの片方だけ空は誤り（D128）
- 要約: 題 = 件名（無ければ本文の最初の行を 40 文字 + …、`summaryTitle`）/ 本文 = 本文 / 画像 = サムネイル / 行き先 = リンクのボタン
- メール（`email.tsx` → `SimpleEmail`）: 全メールの枠の中に 件名の見出し → サムネイル → 本文（改行はそのまま）→ ボタン。値の無い欄は描かない。好みに従う連絡は最後に停止のリンク
- お知らせ（`inApp.tsx` → `SimpleInApp`、client）: サムネイル → 本文 → ボタン（件名は受け取り箱の画面の見出し）

## Extension

- 見た目だけを替える: `SimpleEmail.tsx` / `SimpleInApp.tsx` は 1 行スイッチ（既定 `*.default.tsx`）。fork は隣に `SimpleEmail.replace.tsx` / `SimpleInApp.replace.tsx` を置き、スイッチを向け替える（同じ export と props）
- 全メールの枠（ロゴ・色・末尾）は `src/lib/mail/frame/MailFrame.tsx` のスイッチで一度に替える

## Verification

- `pnpm test src/domains/core/messaging/plugs/messagingLayouts/simple/simple.test.tsx`（宣言・要約・件名はメールを送る時だけ必須と本文の頭の題）。描き方の確かめは管理画面のテンプレートのプレビュー
