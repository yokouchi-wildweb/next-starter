// src/lib/mail/extensionPoints.ts
// src/lib/mail の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 差替点: 1 行スイッチ MailFrame(fork は隣に <名前>.replace を作りスイッチを向け替える)
  mailFrame: {
    change: "replace",
    default: "src/lib/mail/frame/MailFrame.default.tsx",
    type: { from: "@/lib/mail/points", name: "MailFrameProps" },
    side: "server",
  },
};
