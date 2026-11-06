// src/features/core/userLineProfile/extensionPoints.ts
// userLineProfile の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // LINE Webhook のイベント処理: webhookHandlers/<名前>.ts の export const handler(上流の項目は 0)
  webhookHandlers: {
    dir: "webhookHandlers",
    export: "handler",
    type: { from: "@/features/core/userLineProfile/types/webhook", name: "LineWebhookEventHandler" },
    side: "server",
  },
};
