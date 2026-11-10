// src/lib/messaging/extensionPoints.ts
// 連絡の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 上書きの対象: 各ドメインの連絡の定義 messages/<名前>.ts(直下だけ。messages/views/ の描き方は 1 行スイッチの .replace)。
  // fork は隣の <名前>.override.ts(export const messageOverride = { … } satisfies MessageOverride)で次の鍵だけを変える。
  // 止められない連絡(required)の守りは pnpm check extensions が字面で見る(scripts/structure/extensions/derive/messageGuards.mjs)。
  // 欄・{{鍵}} など値の検査は validateMessageDefinition(./definition/validate.ts)
  messages: {
    overrides: "src/features/**/messages/*.ts",
    export: "messageOverride",
    side: "server",
    overrideOf: ["content", "extras", "defaultChannels", "enabled", "adminEditable", "category", "record", "throttle"],
  },
} as const;
