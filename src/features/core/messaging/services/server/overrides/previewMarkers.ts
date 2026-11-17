// src/features/core/messaging/services/server/overrides/previewMarkers.ts
//
// 文言の編集のプレビュー(D86)で、描いた HTML の中の欄の場所に印 data-field="<経路.欄>" を付ける。
// 描き方を変えずに済むよう、描く前に文字の欄の値を目に見えない印の文字で包み、描いた後の HTML で印を <span data-field> に置き換える。
// プレビューの時だけ(送る時は包まない)。TODO(指令 56): 今はプレビューが上書きを重ねないので使っていない(applyPreviewMarkers だけ)。
// 上書きの鍵を ひな形の欄の鍵へ替える時に、ひな形の欄で包み直す
// - 包むのは文字の欄(input line / text、並びは 1 つずつ、parts は中の文字の欄)。url・image・select は属性に入るので包まない
// - タグの中(属性)と <head>(<title> など)に入った印は消すだけ(HTML を壊さない)

import type { ChannelFieldMeta } from "@/lib/messaging";

const OPEN = "";
const SEP = "";
const CLOSE = "";

const isTextInput = (meta: ChannelFieldMeta) => meta.input === "line" || meta.input === "text";

function wrapString(value: string, path: string): string {
  return `${OPEN}${path}${SEP}${value}${CLOSE}`;
}

function wrapValue(value: unknown, meta: ChannelFieldMeta, path: string): unknown {
  if (meta.parts) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const [key, partMeta] of Object.entries(meta.parts)) {
      if (key in out) out[key] = wrapValue(out[key], partMeta, `${path}.${key}`);
    }
    return out;
  }
  if (!isTextInput(meta)) return value;
  if (meta.list && Array.isArray(value)) return value.map((item) => (typeof item === "string" && item !== "" ? wrapString(item, path) : item));
  return typeof value === "string" && value !== "" ? wrapString(value, path) : value;
}

/** 経路の欄の値を印で包む(fieldMeta に約束のある文字の欄だけ) */
export function wrapPreviewFields(
  channel: string,
  content: Readonly<Record<string, unknown>>,
  fieldMeta: Readonly<Record<string, ChannelFieldMeta>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...content };
  for (const [field, meta] of Object.entries(fieldMeta)) {
    if (field in out) out[field] = wrapValue(out[field], meta, `${channel}.${field}`);
  }
  return out;
}

const ESCAPE: Record<string, string> = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };
const escapeAttr = (value: string) => value.replace(/[&"<>]/g, (c) => ESCAPE[c]);
const strip = (text: string) => text.replace(new RegExp(`${OPEN}[^${SEP}]*${SEP}|${CLOSE}`, "g"), "");

/** 描いた HTML の印を <span data-field> に置き換える(タグの中・<head> の印は消すだけ) */
export function applyPreviewMarkers(html: string): string {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? strip(html.slice(0, headEnd)) : "";
  const body = headEnd >= 0 ? html.slice(headEnd) : html;
  const converted = body
    .split(/(<[^>]*>)/)
    .map((token) => {
      if (token.startsWith("<")) return strip(token);
      return token
        .replace(new RegExp(`${OPEN}([^${SEP}]*)${SEP}`, "g"), (_, path: string) => `<span data-field="${escapeAttr(path)}">`)
        .replace(new RegExp(CLOSE, "g"), "</span>");
    })
    .join("");
  return head + converted;
}
