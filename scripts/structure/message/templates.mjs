// scripts/structure/message/templates.mjs
// pnpm generate message が書く定義の雛形(上流の連絡と同じ形: ひな形 + 欄の中身、D122)。ひな形は「汎用のお知らせ」(notice: 件名 + ブロック)で、
// どの経路も描ける(email = ひな形の描き方、inApp・line = 要約から。fork の経路は経路の汎用の描き方か要約からの描き方の宣言で描く)。
// 秘密の値・管理画面で直せる欄・会話の間引き・本文の残し方は注記の行で案内するだけで、既定では付けない。

/**
 * @param {{ path: string, key: string, label: string, category: string, kind: string | null, channels: string[],
 *   vars?: { key: string, alias: string, description: string }[] }} params 種類の種別・経路(書かずに注記だけ)・vars の名前(--var、D133)
 */
export function definitionTemplate({ path, key, label, category, kind, channels, vars = [] }) {
  const first = vars[0];
  const sendVars = first ? `{ ${first.key} }` : "{}";
  const varLines =
    vars.length > 0
      ? ["  vars: z.object({", ...vars.flatMap((item) => [`    /** ${item.description} */`, `    ${item.key}: z.string(),`]), "  }),"]
      : ["  vars: z.object({}),"];
  const nameLines =
    vars.length > 0
      ? [
          "  varNames: {",
          ...vars.map((item) => `    ${item.key}: { alias: ${JSON.stringify(item.alias)}, description: ${JSON.stringify(item.description)} },`),
          "  },",
        ]
      : ["  varNames: {},"];
  const subject = first ? `{{${first.alias}}}` : label;
  const body = first ? `{{${first.alias}}}` : "(知らせる内容)";
  return [
    `// ${path}`,
    "//",
    "// (この連絡が何を知らせるかを 1 行で)。送り手: (呼ぶ場所)",
    `// 送り方: messagingService.sendMessage(message, { recipient: { userId }, vars: ${sendVars} })(@/features/messaging/services/server)`,
    "// ひな形: notice(汎用のお知らせ)。別の見た目は messaging/layouts/<名前>/ のひな形を選ぶか足す(layout と values の欄の鍵を合わせる)",
    `// 種類 ${category}(種別 ${kind ?? "?"}・経路 ${channels.join(" / ")})。種別と経路は種類から引く(定義には書かない)。経路ごとの描き方はひな形と経路が決める`,
    "",
    'import { z } from "zod";',
    "",
    'import { defineMessage } from "@/lib/messaging";',
    "",
    "export const message = defineMessage({",
    `  key: "${key}",`,
    `  label: ${JSON.stringify(label)},`,
    `  category: "${category}",`,
    ...varLines,
    "  // vars の鍵ごとの日本語の別名と説明(全部の鍵に必須。{{別名}} でも {{鍵}} と同じ値で埋まる。共通・enrichers と同じ鍵はその別名)",
    ...nameLines,
    "  // 秘密の値(リンクのトークンなど)は secretVar(z.string()) で印を付ける(本文を記録に残さない。@/lib/messaging)",
    '  // 管理画面で直せる欄の絞り(ひな形の欄の鍵。門 messagingOverrides。無ければ種類の経路で使う欄を全部直せる): adminEditableOnly: ["subject"],',
    ...(first ? [`  // 会話の間引き(同じ受信者 × by の値で続けて送らない): throttle: { by: ["${first.key}"], mode: "untilRead", seconds: 600 },`] : []),
    '  // 本文の残し方(既定 "vars"): record: "meta",',
    '  layout: "notice",',
    "  values: {",
    `    subject: ${JSON.stringify(subject)},`,
    "    blocks: [",
    '      { type: "paragraph", text: "{{受信者名}} 様" },',
    `      { type: "paragraph", text: ${JSON.stringify(body)} },`,
    '      // { type: "button", label: "確かめる", url: "{{サイトのURL}}/" },',
    "    ],",
    "  },",
    "});",
    "",
  ].join("\n");
}
