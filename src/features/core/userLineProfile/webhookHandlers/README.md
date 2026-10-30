# webhookHandlers(LINE Webhook のイベント処理の受け口)

`<名前>.<fork の名前>.ts` に `export const handler: LineWebhookEventHandler`(`eventType` と `handle`)を置き、`pnpm extensions:generate`。上流の項目は 0(イベントは何もせず 200)。
同じ `eventType` の項目は一覧の順(ファイル名の順)に全部呼ばれ、1 つ失敗してもログに残して続行する。
書き方: `src/lib/line/README.md`「Webhook イベント処理」/ 仕組み: `scripts/extensions/README.md`
