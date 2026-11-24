// src/lib/cron/extensionPoints.ts
// cron の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 上書きの対象: 各タスクの task.ts。fork は隣の task.override.ts(export const cronOverride)で次の鍵だけを変える。
  // 値の検査(cron 式・真偽)は読み手 ./discover.ts
  cronTasks: {
    change: "override",
    overrides: "src/app/api/cron/*/task.ts",
    export: "cronOverride",
    side: "server",
    overrideOf: ["schedule", "disabled"],
  },
  // メンテナンスの判定: 差す側の <ドメイン>/plugs/cronMaintenance/<名前>.ts の export const plug({ deps: { isActive } })。
  // 0〜1 個: 上流は setting が差す。空ならメンテナンスで飛ばさない(lib の既定)。一覧は生成物 src/wiring/cron.ts、結ぶのは src/wiring/cronRoute.ts
  cronMaintenance: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/lib/cron/points", name: "CronMaintenancePlug" },
    side: "server",
    max: 1,
    target: "wiring",
  },
  // 期限の削除の規則: 差す側の <ドメイン>/plugs/expiryRules/<名前>.ts(lib は <lib>/plugs/…)の export const rule = { table, key, rule, where?, batchSize?, pii? }。
  // 1 本の定期処理 src/app/api/cron/expiry-prune が門番で閉じたドメインの項目を外して順に消す(結ぶのは src/wiring/expiryPrune.ts)。上流の項目は 0。
  // fork の上書き(隣の <名前>.override.ts)は enabled・batchSize だけ。pii: true の項目に enabled: false は書けない(生成と検査が止める、pii_prune_kept)
  expiryRules: {
    change: "add",
    plugs: true,
    export: "rule",
    type: { from: "@/lib/cron/points", name: "ExpiryRule" },
    side: "server",
    target: "wiring",
    overrideOf: ["enabled", "batchSize"],
    overrideRefuse: { flag: "pii", key: "enabled", value: false },
  },
} as const;
