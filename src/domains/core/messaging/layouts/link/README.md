# link（上流のレイアウト「認証のリンク」）

## Overview

リンクを押してもらう認証のメール（確認・事前登録・パスワードの再設定・メールアドレスの変更）のレイアウト（D122・D123）。定義連絡だけが使い、管理者はテンプレートで選べない（`adminSelectable: false`）。受け口の仕組みは `../README.md`、型と語彙は `src/lib/messaging/README.md`「レイアウト」。auth の連絡 4 本(`verification`・`earlyRegistration`・`passwordReset`・`emailChange`)が使う。

## Usage

- 欄: `subject`（件名、必須）・`preheader`（プレビューの文）・`heading`（見出し、必須）・`received`（受付の文、必須）・`buttonGuide`（ボタンの案内）・`button`（ボタン `{ label, url }`、必須）・`urlGuide`（URL の案内）・`footer`（末尾の注意書き）
- 要約: 題 = 件名 / 本文 = 受付の文 + ボタンの案内（空行でつなぐ）/ 行き先 = ボタン / 短い本文 = プレビューの文。ボタンの URL は秘密の値になりうる（記録に残さないのは送る口の役目）
- メール（`email.tsx` → `LinkEmail`）: 前の auth の LinkMailView と同じ並び: 見出し → 受付の文 → ボタンの案内 → ボタン → URL の案内 → ボタンの URL をそのまま → 末尾の注意書き。値の無い欄は描かない。好みに従う連絡は最後に停止のリンク
- お知らせ（`inApp.tsx` → `LinkInApp`、client）: 受付の文・ボタンの案内・ボタン（件名は受け取り箱の画面の見出し）

## Extension

- 見た目だけを替える: `LinkEmail.tsx` / `LinkInApp.tsx` は 1 行スイッチ（既定 `*.default.tsx`）。fork は隣に `LinkEmail.replace.tsx` / `LinkInApp.replace.tsx` を置き、スイッチを向け替える（同じ export と props）
- 全メールの枠（ロゴ・色・末尾）は `src/lib/mail/frame/MailFrame.tsx` のスイッチで一度に替える

## Verification

- `pnpm test src/domains/core/messaging/layouts/link/link.test.tsx`（宣言・要約・メールの部品の並び・お知らせ・生成の一覧）
