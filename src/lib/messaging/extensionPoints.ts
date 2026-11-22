// src/lib/messaging/extensionPoints.ts
// 連絡の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 上書きの対象: 各ドメインの連絡定義 messages/<名前>.ts(直下だけ)。見た目はレイアウトの描き方(messaging/layouts の 1 行スイッチの .replace)。
  // fork は隣の <名前>.override.ts(export const messageOverride = { … } satisfies MessageOverride)で次の鍵だけを変える(label = 管理画面の名前、表示だけ。
  // values = レイアウトの欄の中身を欄ごとに差し替える。レイアウト(layout)は変えられない)。
  // category = 所属のカテゴリーの付け替え(fork のカテゴリーも可、種別が違ってもよい、functional の連絡も可 D166・D167)。
  // adminText = 管理者が送る画面の文(D214 (3))の丸ごとの差し替え(表示だけ)。
  // channelModes = 送信チャンネルの固定(D212)の丸ごとの差し替え。カテゴリーの送信チャンネルの集まりはカテゴリーの override で変える(D86)。
  // 種別の性質の検査(required の email・email を外せない種別・上流の functional を止めない)は上書きの後の値に掛かる。
  // 止められない連絡(required)・上流の functional の守りは pnpm check extensions が字面で見る(scripts/structure/extensions/derive/messageGuards.mjs)。
  // 欄・{{鍵}} など値の検査は validateMessageDefinition(./definition/validate.ts)
  messages: {
    overrides: "src/features/**/messages/*.ts",
    export: "messageOverride",
    side: "server",
    overrideOf: ["label", "values", "extras", "enabled", "adminEditableOnly", "record", "throttle", "category", "channelModes", "adminText"],
  },
  // 上書きの対象: 各ドメインの記録の宛先 recordTargets/<名前>.ts(直下だけ。集めるのは pnpm generate registry、型 ./recordTargets/types.ts)。
  // fork は隣の <名前>.override.ts(export const recordTargetOverride = { … } satisfies MessageRecordTargetOverride)で
  // messages(この項目で送れる連絡定義の並び)だけを丸ごと差し替える(D217)。名指しの先の実在と adminTargets の records は生成器が確かめる
  recordTargets: {
    overrides: "src/features/**/recordTargets/*.ts",
    export: "recordTargetOverride",
    side: "server",
    overrideOf: ["messages"],
  },
} as const;
