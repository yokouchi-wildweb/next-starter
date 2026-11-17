# simple（上流のひな形「シンプルなお知らせ」）

## Overview

件名・サムネイル・本文・リンクのボタンだけの短いお知らせのひな形（D119）。管理者がテンプレートで選べる（`adminSelectable: true`）。管理の 3 種別の既定の白紙（システムテンプレート `announcement`・`direct`・`promotion`）が使う。ブロックを並べるリッチな形は `notice`。受け口の仕組みは `../README.md`、型と語彙は `src/lib/messaging/README.md`「ひな形」。

## Usage

- 欄: `subject`（1行テキスト、必須）・`image`（画像 = サムネイル）・`body`（段落）・`link`（ボタン `{ label, url }`）
- 要約: 題 = 件名 / 本文 = 本文 / 画像 = サムネイル / 行き先 = リンクのボタン
- メール（`email.tsx` → `SimpleEmail`）: 全メールの枠の中に 件名の見出し → サムネイル → 本文（改行はそのまま）→ ボタン。値の無い欄は描かない。好みに従う連絡は最後に停止のリンク
- お知らせ（`inApp.tsx` → `SimpleInApp`、client）: サムネイル → 本文 → ボタン（件名は受け取り箱の画面の見出し）

## Extension

- 見た目だけを替える: `SimpleEmail.tsx` / `SimpleInApp.tsx` は 1 行スイッチ（既定 `*.default.tsx`）。fork は隣に `SimpleEmail.replace.tsx` / `SimpleInApp.replace.tsx` を置き、スイッチを向け替える（同じ export と props）
- 全メールの枠（ロゴ・色・末尾）は `src/lib/mail/frame/MailFrame.tsx` のスイッチで一度に替える

## Verification

- テストはまだ無い（D112: 出荷の前にまとめて書く）。確かめは管理画面のテンプレートのプレビュー
