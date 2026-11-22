# userLineProfile

## Overview

- LINE のプロフィールと Webhook のイベント処理を持つドメイン
- Webhook のイベントごとの処理は点 `userLineProfileWebhookHandlers`: 差す側の `<ドメイン>/plugs/userLineProfileWebhookHandlers/<名前>.ts` に `export const handler: LineWebhookEventHandler`(`eventType` と `handle`)を置き、`pnpm generate extensions`。上流の項目は 0(イベントは何もせず 200)

## Internals

- 同じ `eventType` の項目は一覧の順(差す側 → ファイル名の順)に全部呼ばれ、1 つ失敗してもログに残して続ける。項目のドメインが閉じていれば呼ばない(route が `gate.plugs` で外す)

## Related

- 書き方と例: `src/lib/line/README.md`「Webhook イベント処理」
- 点の仕組み: `scripts/structure/extensions/README.md`「plugs の点」
