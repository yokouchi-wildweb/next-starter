// src/features/core/messaging/utils/noticeValues.ts
//
// 経路ごとに書いた文面 → ひな形「汎用のお知らせ」(notice)の欄の中身(件名 + ブロックの並び)。server と client の両方が使う純な関数。
// 送る画面の文面は S5 まで経路ごとの形なので、送る画面(送る時の values を組む)とテンプレートの最小の編集画面がここで
// 1 つの中身にする(指令 55・56)。
// - email の欄があればそれ: 件名 → subject、見出し → 小見出し、段落 → 段落、ボタン → ボタン、フッター → 段落
// - 無ければ inApp(と fork の経路の同じ形の欄): 題(title・subject)→ subject、画像 → 画像、本文 → 段落、行き先 → ボタン(「詳しく見る」)
// - 無ければ line(と text だけの経路): 本文 → subject と段落
// 経路だけの文(例 お知らせだけの文)は使わない(S5 まで)。変えた中身の検査は送る口(ひな形の欄の zod)
// DB のテンプレートは指令 58 から notice の欄の中身を持つ(送る口はここを通らない)。テンプレートの最小の編集画面は逆向き(emailFieldsFromNoticeValues)も使う

import type { MessageBlock } from "@/lib/messaging";

const text = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

export function noticeValuesFromChannelContent(content: Readonly<Record<string, unknown>>): { subject: string; blocks: MessageBlock[] } {
  const objects = Object.entries(content).filter(
    (entry): entry is [string, Record<string, unknown>] => Boolean(entry[1]) && typeof entry[1] === "object",
  );
  const email = content.email as Record<string, unknown> | undefined;
  const inApp =
    (content.inApp as Record<string, unknown> | undefined) ??
    objects.find(([key, fields]) => key !== "email" && (text(fields.title) ?? text(fields.subject)))?.[1];
  const line =
    (content.line as Record<string, unknown> | undefined) ?? objects.find(([key, fields]) => key !== "email" && text(fields.text))?.[1];
  const blocks: MessageBlock[] = [];
  if (email) {
    const heading = text(email.heading);
    if (heading) blocks.push({ type: "heading", text: heading });
    for (const paragraph of Array.isArray(email.paragraphs) ? email.paragraphs : []) {
      const value = text(paragraph);
      if (value) blocks.push({ type: "paragraph", text: value });
    }
    const cta = email.cta as { label?: unknown; url?: unknown } | undefined;
    if (cta && text(cta.label) && text(cta.url)) blocks.push({ type: "button", label: text(cta.label)!, url: text(cta.url)! });
    const footer = text(email.footer);
    if (footer) blocks.push({ type: "paragraph", text: footer });
    return { subject: text(email.subject) ?? "", blocks };
  }
  if (inApp) {
    const image = text(inApp.image);
    if (image) blocks.push({ type: "image", src: image });
    const body = text(inApp.body);
    if (body) blocks.push({ type: "paragraph", text: body });
    const link = text(inApp.link);
    if (link) blocks.push({ type: "button", label: "詳しく見る", url: link });
    return { subject: text(inApp.title) ?? text(inApp.subject) ?? "", blocks };
  }
  const lineText = text(line?.text) ?? "";
  return { subject: lineText, blocks: lineText ? [{ type: "paragraph", text: lineText }] : [] };
}

/**
 * notice の欄の中身 → メールの欄の形(件名・見出し・段落・ボタン)。テンプレートの最小の編集画面(S5 で作り直す)が
 * notice の中身をメールの欄の部品で直すための読み替え。最初の見出しと最初のボタンだけを拾い、段落は並びのまま、ほかのブロックは落とす
 */
export function emailFieldsFromNoticeValues(values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const blocks = Array.isArray(values.blocks) ? (values.blocks as MessageBlock[]) : [];
  const heading = blocks.find((block) => block.type === "heading");
  const button = blocks.find((block) => block.type === "button");
  const paragraphs = blocks.flatMap((block) => (block.type === "paragraph" ? [block.text] : []));
  return {
    subject: text(values.subject) ?? "",
    ...(heading?.type === "heading" ? { heading: heading.text } : {}),
    ...(paragraphs.length > 0 ? { paragraphs } : {}),
    ...(button?.type === "button" ? { cta: { label: button.label, url: button.url } } : {}),
  };
}
