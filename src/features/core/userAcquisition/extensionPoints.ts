// src/features/core/userAcquisition/extensionPoints.ts
// userAcquisition の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 獲得経路の判別表の行: channels/<名前>.ts の export const channel(上流の項目 = 招待 invite)。
  // 広告のクリック ID の行は 設定(./config.ts)の clickIdParams から作り、項目の前に並ぶ
  channels: {
    dir: "channels",
    export: "channel",
    type: { from: "@/features/core/userAcquisition/types/channel", name: "AcquisitionChannelItem" },
    side: "shared",
    key: "param",
  },
};
