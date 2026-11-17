# notice（上流のひな形「汎用のお知らせ」）

## Overview

件名とブロックの並び（小見出し・段落・ボタン・画像・区切り・ラベルと値・箇条書き）で書くお知らせのひな形（D122・D123）。管理者がテンプレートで選べる（`adminSelectable: true`）。受け口の仕組みは `../README.md`、型と語彙は `src/lib/messaging/README.md`「ひな形」。リッチな白紙のシステムテンプレート 3 本(`announcementRich`・`directRich`・`promotionRich`)・管理者のテンプレート・wallet の `adjustmentNotice` が使う。短い形は `simple`。

## Usage

- 欄: `subject`（1行テキスト、必須）・`blocks`（ブロックの並び、任意（件名だけのお知らせも書ける）、7 種類どれも可）
- 要約: 題 = 件名 / 本文 = 段落のブロックを空行でつないだ文 / 画像 = 最初の画像のブロック / 行き先 = 最初のボタンのブロック `{ label, url }`（`summarizeBlocks`）
- メール（`email.tsx` → `NoticeEmail`）: 全メールの枠の中に件名の見出しとブロックを 1 種類 1 部品（lib/mail の部品）で並べ、好みに従う連絡は最後に停止のリンク
- お知らせ（`inApp.tsx` → `NoticeInApp`、client）: ブロックを components の部品で並べる（件名は受け取り箱の画面の見出し）

## Extension

- 見た目だけを替える: `NoticeEmail.tsx` / `NoticeInApp.tsx` は 1 行スイッチ（既定 `*.default.tsx`）。fork は隣に `NoticeEmail.replace.tsx` / `NoticeInApp.replace.tsx` を置き、スイッチを向け替える（同じ export と props）
- 全メールの枠（ロゴ・色・末尾）は `src/lib/mail/frame/MailFrame.tsx` のスイッチで一度に替える

## Verification

- `pnpm test src/features/core/messaging/layouts/notice/notice.test.tsx`（宣言・要約・メールとお知らせのブロックの種類ごとの描き方・生成の一覧）
