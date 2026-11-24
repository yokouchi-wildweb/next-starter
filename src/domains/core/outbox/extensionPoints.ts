// src/domains/core/outbox/extensionPoints.ts
// 送り箱の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 常設にしない(D22・D53): 機能の規則 src/featureGate/rules/outbox.ts が挙げた時だけ開き、閉じれば表と定期処理が閉じる

export const extensionPoints = {
  // 送り箱の処理: 差す側の <ドメイン>/plugs/outboxHandlers/<名前>.ts(lib は <lib>/plugs/…)の export const handler = { kind, schema, handle, maxAttempts?, backoff? }。
  // kind = "<差した地区>.<動作>"(先頭が違えば生成で止める、keyPrefix)、全体で一意。使う時に gate.plugs で閉じたドメインの項目を外す(その行は保留)。上流の項目は 0
  // 上書き: maxAttempts・backoff だけ(上流の項目の隣の <名前>.override.ts)
  outboxHandlers: {
    change: "add",
    plugs: true,
    export: "handler",
    type: { from: "@/domains/core/outbox/points", name: "OutboxHandler" },
    side: "server",
    key: "kind",
    keyPrefix: "district",
    // fork が上流の項目の隣の <名前>.override.ts で変えてよい鍵(型 2)
    overrideOf: ["maxAttempts", "backoff"],
  },
};
