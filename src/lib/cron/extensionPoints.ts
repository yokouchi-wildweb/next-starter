// src/lib/cron/extensionPoints.ts
// cron の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 上書きの対象: 各タスクの task.ts。fork は隣の task.override.ts(export const cronOverride)で次の鍵だけを変える。
  // 値の検査(cron 式・真偽)は読み手 ./discover.ts
  cronTasks: {
    overrides: "src/app/api/cron/*/task.ts",
    side: "server",
    overrideOf: ["schedule", "disabled"],
  },
} as const;
