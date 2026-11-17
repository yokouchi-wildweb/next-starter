# alert（上流のひな形「セキュリティの警告」）

## Overview

アカウントのロックなどの警告のひな形（D122・D123）。コードの連絡だけが使い、管理者はテンプレートで選べない（`adminSelectable: false`）。受け口の仕組みは `../README.md`、型と語彙は `src/lib/messaging/README.md`「ひな形」。auth の `accountLocked` が使う。

## Usage

- 欄: `subject`（件名、必須）・`preheader`（プレビューの文）・`heading`（見出し、必須）・`explanation`（説明、必須）・`details`（ラベルと値 `[{ key, value }]`。値が空の行は出さない）・`notYou`（心当たりがない場合）・`ifYou`（心当たりがある場合）・`footer`（末尾の注意書き）。心当たりの 2 つは最初の行を太字、残りを次の行に描く
- 要約: 題 = 件名 / 本文 = 説明 / 短い本文 = プレビューの文
- メール（`email.tsx` → `AlertEmail`）: 前の auth の accountLocked の描き方と同じ並び: 見出し → 説明 → 情報の箱（`details`）→ 心当たりがない場合 → ある場合 → 末尾の注意書き。値の無い欄は描かない。好みに従う連絡は最後に停止のリンク
- お知らせ（`inApp.tsx` → `AlertInApp`、client）: 説明・ラベルと値・心当たりの段落（件名は受け取り箱の画面の見出し）

## Extension

- 見た目だけを替える: `AlertEmail.tsx` / `AlertInApp.tsx` は 1 行スイッチ（既定 `*.default.tsx`）。fork は隣に `AlertEmail.replace.tsx` / `AlertInApp.replace.tsx` を置き、スイッチを向け替える（同じ export と props）
- 全メールの枠（ロゴ・色・末尾）は `src/lib/mail/frame/MailFrame.tsx` のスイッチで一度に替える

## Verification

- `pnpm test src/features/core/messaging/layouts/alert/alert.test.tsx`（宣言・要約・メールの部品の並び・お知らせ・生成の一覧）
