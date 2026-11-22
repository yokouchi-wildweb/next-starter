// src/features/core/messaging/services/server/overrides/previewMarkers.ts
//
// テキストの編集のプレビュー(D86)で、描いた HTML の中の欄の場所に印 data-field="<欄の鍵>" を付ける。
// 描き方を変えずに済むよう、描く前にレイアウトの欄の中身の文字を目に見えない印の文字で包み、描いた後の HTML で印を <span data-field> に置き換える。
// プレビューの時だけ(送る時は包まない)。
// - 包むのは文字: 1行テキスト・段落・複数行テキスト、その並び、ボタン・リンクの label、ブロックの text・label・箇条書きの項目、組の中の同じ物。
//   画像・URL・日付・数・選択肢は属性や形の決まった値なので包まない
// - タグの中(属性)と <head>(<title> など)に入った印は消すだけ(HTML を壊さない)

import type { MessageFieldShape, MessageLayout } from "@/lib/messaging";

const OPEN = "";
const SEP = "";
const CLOSE = "";

const TEXT_TYPES = new Set(["line", "paragraph", "longText"]);

function wrapString(value: unknown, path: string): unknown {
  return typeof value === "string" && value !== "" ? `${OPEN}${path}${SEP}${value}${CLOSE}` : value;
}

function wrapLabel(value: unknown, path: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out = { ...(value as Record<string, unknown>) };
  if ("label" in out) out.label = wrapString(out.label, path);
  return out;
}

function wrapBlock(block: unknown, path: string): unknown {
  if (!block || typeof block !== "object" || Array.isArray(block)) return block;
  const out = { ...(block as Record<string, unknown>) };
  if ("text" in out) out.text = wrapString(out.text, path);
  if ("label" in out) out.label = wrapString(out.label, path);
  if (Array.isArray(out.items)) out.items = out.items.map((item) => wrapString(item, path));
  return out;
}

function wrapValue(value: unknown, shape: MessageFieldShape, path: string): unknown {
  if (TEXT_TYPES.has(shape.type)) return wrapString(value, path);
  if (shape.type === "button" || shape.type === "link") return wrapLabel(value, path);
  if (shape.type === "list") return Array.isArray(value) ? value.map((item) => wrapValue(item, shape.of, path)) : value;
  if (shape.type === "blocks") return Array.isArray(value) ? value.map((block) => wrapBlock(block, path)) : value;
  if (shape.type === "group") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const out = { ...(value as Record<string, unknown>) };
    for (const [key, sub] of Object.entries(shape.fields)) if (key in out) out[key] = wrapValue(out[key], sub, path);
    return out;
  }
  return value;
}

/** レイアウトの欄の中身を印で包む(印の道 = 欄の鍵) */
export function wrapPreviewValues(layout: MessageLayout, values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [key, spec] of Object.entries(layout.fields)) {
    if (key in out) out[key] = wrapValue(out[key], spec, key);
  }
  return out;
}

const ESCAPE: Record<string, string> = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };
const escapeAttr = (value: string) => value.replace(/[&"<>]/g, (c) => ESCAPE[c]);
/** 印を消す(文字だけのプレビュー・タグの中・<head>) */
export const stripPreviewMarkers = (text: string) => text.replace(new RegExp(`${OPEN}[^${SEP}]*${SEP}|${CLOSE}`, "g"), "");

/** 描いた HTML の印を <span data-field> に置き換える(タグの中・<head> の印は消すだけ) */
export function applyPreviewMarkers(html: string): string {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? stripPreviewMarkers(html.slice(0, headEnd)) : "";
  const body = headEnd >= 0 ? html.slice(headEnd) : html;
  const converted = body
    .split(/(<[^>]*>)/)
    .map((token) => {
      if (token.startsWith("<")) return stripPreviewMarkers(token);
      return token
        .replace(new RegExp(`${OPEN}([^${SEP}]*)${SEP}`, "g"), (_, path: string) => `<span data-field="${escapeAttr(path)}">`)
        .replace(new RegExp(CLOSE, "g"), "</span>");
    })
    .join("");
  return head + converted;
}
