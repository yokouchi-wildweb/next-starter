# webhookHandlers(LINE Webhook のイベント処理の受け口)

## Overview

LINE の Webhook のイベントごとの処理を置く受け口。`<名前>.ts` に `export const handler: LineWebhookEventHandler`(`eventType` と `handle`)を置き、`pnpm generate extensions`。上流の項目は 0(イベントは何もせず 200)。

## Internals

- 同じ `eventType` の項目は一覧の順(ファイル名の順)に全部呼ばれ、1 つ失敗してもログに残して続ける

## Related

- 書き方と例: `src/lib/line/README.md`「Webhook イベント処理」
- 受け口の仕組み: `scripts/structure/extensions/README.md`
