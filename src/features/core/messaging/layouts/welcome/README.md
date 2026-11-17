# welcome（上流のひな形「ようこそ」）

## Overview

登録の完了の知らせ（会員登録・事前登録）のひな形（D122・D123）。コードの連絡だけが使い、管理者はテンプレートで選べない（`adminSelectable: false`）。受け口の仕組みは `../README.md`、型と語彙は `src/lib/messaging/README.md`「ひな形」。user の連絡 2 本(`registrationComplete`・`earlyRegistrationComplete`)が使う。

## Usage

- 欄: `subject`（件名、必須）・`preheader`（プレビューの文）・`badge`（ロゴの下の札）・`heading`（お祝いの見出し、必須）・`thanks`（お礼、必須）・`guide`（案内）・`button`（ボタン、任意）・`footer`（末尾の注意書き）
- 要約: 題 = 件名 / 本文 = お礼 + 案内（空行でつなぐ）/ 行き先 = ボタン（あれば）/ 短い本文 = プレビューの文
- メール（`email.tsx` → `WelcomeEmail`）: 前の user の WelcomeMailView と同じ並び: ロゴ（事業の設定）と札 → お祝いの見出し → お礼 → 区切り → 案内 → ボタン（あれば、強調の色）→ 区切り → 末尾の注意書き（改行はそのまま）。値の無い欄は描かない。好みに従う連絡は最後に停止のリンク
- お知らせ（`inApp.tsx` → `WelcomeInApp`、client）: 札・お祝いの見出し・お礼・案内・ボタン（件名は受け取り箱の画面の見出し）

## Extension

- 見た目だけを替える: `WelcomeEmail.tsx` / `WelcomeInApp.tsx` は 1 行スイッチ（既定 `*.default.tsx`）。fork は隣に `WelcomeEmail.replace.tsx` / `WelcomeInApp.replace.tsx` を置き、スイッチを向け替える（同じ export と props）
- 全メールの枠（ロゴ・色・末尾）は `src/lib/mail/frame/MailFrame.tsx` のスイッチで一度に替える

## Verification

- `pnpm test src/features/core/messaging/layouts/welcome/welcome.test.tsx`（宣言・要約・メールの部品の並び・お知らせ・生成の一覧）
