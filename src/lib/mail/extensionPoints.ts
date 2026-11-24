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
  // 選ぶ点(D11・D38): メールの口。実装 = plugs/mail/<名前>.ts の declaration + adapter、選ぶのは選択表 backend-selection.json の mail。
  // 生成物 ./extensions/mail.ts が選んだ 1 つの adapter だけを読む。compat = 選択表を作る時(fill)と使う時の食い違いの守りの読み方
  mail: {
    change: "add",
    plugs: true,
    export: "adapter",
    type: { from: "@/lib/mail/points", name: "MailAdapter" },
    side: "server",
    select: {
      port: "mail",
      optional: false,
      words: ["send"],
      compat: { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "sendgrid", resend: "resend" }, default: "resend" },
    },
  },
};
