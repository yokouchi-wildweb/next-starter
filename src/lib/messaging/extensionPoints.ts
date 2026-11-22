// src/lib/messaging/extensionPoints.ts
// 連絡の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 上書きの対象: 各ドメインの連絡定義 messages/<名前>.ts(直下だけ)。見た目はレイアウトの描き方(messaging/layouts の 1 行スイッチの .replace)。
  // fork は隣の <名前>.override.ts(export const messageOverride = { … } satisfies MessageOverride)で次の鍵だけを変える(label = 管理画面の名前、表示だけ。
  // values = レイアウトの欄の中身を欄ごとに差し替える。レイアウト(layout)は変えられない)。
  // カテゴリー(category)の付け替えと送信チャンネルの変更は無い(カテゴリーは付け替えない D74、送信チャンネルはカテゴリーの override で変える D86)。
  // 止められない連絡(required)・上流の functional の守りは pnpm check extensions が字面で見る(scripts/structure/extensions/derive/messageGuards.mjs)。
  // 欄・{{鍵}} など値の検査は validateMessageDefinition(./definition/validate.ts)
  messages: {
    overrides: "src/features/**/messages/*.ts",
    export: "messageOverride",
    side: "server",
    overrideOf: ["label", "values", "extras", "enabled", "adminEditableOnly", "record", "throttle"],
  },
} as const;
