// scripts/structure/message/templates.mjs
// pnpm generate message が書く 3 本の雛形(上流の連絡と同じ形: D24 の欄、D25 の描き方の 1 行スイッチ + 既定)。
// 秘密の値・管理画面で直せる欄・会話の間引き・本文の残し方は注記の行で案内するだけで、既定では付けない。

/** 上流の経路の欄の雛形(fork の経路は欄の zod を知らないので空 + 注記) */
const CHANNEL_CONTENT = {
  email: [
    "    email: {",
    '      subject: "{{summary}}",',
    '      preheader: "{{summary}}",',
    '      heading: "{{summary}}",',
    '      paragraphs: ["{{recipientName}} 様", "{{summary}}"],',
    '      // cta: { label: "確かめる", url: "{{appBaseUrl}}/" },',
    '      footer: "{{serviceName}}",',
    "    },",
  ],
  inApp: ["    inApp: {", '      title: "{{summary}}",', '      body: "{{summary}}",', '      // link: "/",', "    },"],
  line: ["    line: {", '      text: "{{summary}}",', "    },"],
};

/** @param {{ path: string, key: string, category: string, kind: string | null, channels: string[] }} params 種類の種別・経路(書かずに注記だけ) */
export function definitionTemplate({ path, key, category, kind, channels }) {
  const content = channels.flatMap((channel) =>
    CHANNEL_CONTENT[channel] ?? [`    // ${channel}: 経路 ${channel} の欄(経路の fields の zod)に合わせて書く`, `    ${channel}: {},`],
  );
  const view = channels.includes("email") ? `メールの描き方: views/${key.split(".")[1]}.tsx(既定 views/${key.split(".")[1]}.default.tsx)` : "メールの経路が無いので描き方のファイルは無い";
  return [
    `// ${path}`,
    "//",
    "// (この連絡が何を知らせるかを 1 行で)。送り手: (呼ぶ場所)",
    `// 送り方: messagingService.sendMessage(message, { recipient: { userId }, vars: { summary } })(@/features/messaging/services/server)`,
    `// ${view}`,
    `// 種類 ${category}(種別 ${kind ?? "?"}・経路 ${channels.join(" / ")})。種別と経路は種類から引く(定義には書かない)。文面は種類の経路の分だけ要る`,
    "",
    'import { z } from "zod";',
    "",
    'import { defineMessage } from "@/lib/messaging";',
    "",
    "export const message = defineMessage({",
    `  key: "${key}",`,
    `  category: "${category}",`,
    "  vars: z.object({",
    "    /** 例の値(この連絡が受ける値に置き換える) */",
    "    summary: z.string(),",
    "  }),",
    "  // 秘密の値(リンクのトークンなど)は secretVar(z.string()) で印を付ける(本文を記録に残さない。@/lib/messaging)",
    '  // 管理画面で直せる欄(門 messagingOverrides): adminEditable: ["email.subject", "inApp.title"],',
    '  // 会話の間引き(同じ受信者 × by の値で続けて送らない): throttle: { by: ["summary"], mode: "untilRead", seconds: 600 },',
    '  // 本文の残し方(既定 "vars"): record: "meta",',
    "  content: {",
    ...content,
    "  },",
    "});",
    "",
  ].join("\n");
}

/** @param {{ key: string, name: string }} params */
export function viewSwitchTemplate({ key, name }) {
  return [
    `// 1 行スイッチ: 連絡 ${key} のメールの描き方。既定 = ./${name}.default(別の描き方にするときはこの行の向き先を替える)`,
    `export { EmailView } from "./${name}.default";`,
    "",
  ].join("\n");
}

/** メールの経路の既定の描き方と同じ見た目(lib/mail の部品) */
export function viewDefaultTemplate({ path, key }) {
  return [
    `// ${path}`,
    "//",
    `// 連絡 ${key} の既定の描き方。欄(heading・paragraphs・cta・footer)を lib/mail の枠と部品で描く(メールの経路の既定と同じ見た目)`,
    "",
    'import type { MessageEmailViewProps } from "@/lib/messaging";',
    'import { MailButton, MailFooter, MailFrame, MailHeading, MailNote, MailParagraph, MailUrl, type MailTheme } from "@/lib/mail";',
    "",
    "export function EmailView({ content, theme, unsubscribeUrl }: MessageEmailViewProps<MailTheme>) {",
    "  return (",
    "    <MailFrame theme={theme} preview={content.preheader}>",
    "      {content.heading ? <MailHeading theme={theme}>{content.heading}</MailHeading> : null}",
    "      {(content.paragraphs ?? []).map((paragraph, index) => (",
    "        <MailParagraph key={index} theme={theme} preWrap>",
    "          {paragraph}",
    "        </MailParagraph>",
    "      ))}",
    "      {content.cta ? (",
    "        <MailButton theme={theme} href={content.cta.url}>",
    "          {content.cta.label}",
    "        </MailButton>",
    "      ) : null}",
    "      {content.footer ? <MailFooter theme={theme}>{content.footer}</MailFooter> : null}",
    "      {unsubscribeUrl ? (",
    '        <MailNote theme={theme} align="center">',
    "          この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。",
    "        </MailNote>",
    "      ) : null}",
    "    </MailFrame>",
    "  );",
    "}",
    "",
  ].join("\n");
}
