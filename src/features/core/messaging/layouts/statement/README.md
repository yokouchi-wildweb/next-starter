# statement（上流のひな形「お知らせの明細」）

## Overview

札・宛名・本文の知らせ（財布の失効の予告・本通知など）のひな形（D122・D123）。コードの連絡だけが使い、管理者はテンプレートで選べない（`adminSelectable: false`）。受け口の仕組みは `../README.md`、型と語彙は `src/lib/messaging/README.md`「ひな形」。wallet の失効の知らせ 2 本(`expiringNotice`・`expiredNotice`)が使う。

## Usage

- 欄: `subject`（件名、必須）・`preheader`（プレビューの文）・`badge`（ロゴの下の札。例「… からのお知らせ」）・`addressee`（宛名。例「… 様」）・`body`（本文、長い文、必須）・`footer`（末尾の注意書き）・`shortBody`（短い本文、お知らせと LINE だけの欄）
- 要約: 題 = 件名 / 本文 = 本文 / 短い本文 = `shortBody`、無ければプレビューの文（お知らせの一覧の本文と LINE の文になる）
- メール（`email.tsx` → `StatementEmail`）: 前の wallet の NoticeMailView と同じ並び: ロゴ（事業の設定）と札 → 宛名 → 区切り → 本文（改行はそのまま）→ 区切り → 末尾の注意書き。値の無い欄は描かない。好みに従う連絡は最後に停止のリンク
- お知らせ（`inApp.tsx` → `StatementInApp`、client）: 宛名と本文（改行はそのまま）（件名は受け取り箱の画面の見出し）

## Extension

- 見た目だけを替える: `StatementEmail.tsx` / `StatementInApp.tsx` は 1 行スイッチ（既定 `*.default.tsx`）。fork は隣に `StatementEmail.replace.tsx` / `StatementInApp.replace.tsx` を置き、スイッチを向け替える（同じ export と props）
- 全メールの枠（ロゴ・色・末尾）は `src/lib/mail/frame/MailFrame.tsx` のスイッチで一度に替える

## Verification

- `pnpm test src/features/core/messaging/layouts/statement/statement.test.tsx`（宣言・要約・メールの部品の並び・お知らせ・生成の一覧）
