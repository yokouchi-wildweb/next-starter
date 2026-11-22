// src/domains/core/messaging/components/common/LayoutPreview/previewMarkers.ts
// テンプレートのプレビューの空の欄の目印(D127)。空の欄は欄の見出しを私用の字で囲んだ目印(\uE000<見出し>\uE001)で描かせ、
// 描いた後の HTML で目印を仮の枠に置き換える: 文 = 薄い地の枠、リンク・ボタン = 点線の枠(行き先なし)。
// 送る口はプレビューを通らないので、送った連絡に目印は入らない。送る画面のプレビュー(mode send)は空の欄を落とすだけで目印を使わない。
// 枠の見た目は style の直書き(メールの iframe の中にも効くように。値はプレビュー専用の中立の色)

/** 目印の始まり・終わり(私用の字。人が書く文には出ない) */
export const PREVIEW_MARKER_OPEN = "\uE000";
export const PREVIEW_MARKER_CLOSE = "\uE001";

/** 欄の見出し → 目印 */
export function previewMarker(label: string): string {
  return `${PREVIEW_MARKER_OPEN}${label}${PREVIEW_MARKER_CLOSE}`;
}

const MARKER = /\uE000([^\uE000\uE001]*)\uE001/g;

// プレビュー専用の中立の色(トークンは iframe の中に届かない)
const TEXT_BOX_STYLE =
  "display:inline-block;padding:2px 8px;border-radius:4px;background:#f1f3f5;color:#868e96;font-size:0.9em;line-height:1.6;";
const BUTTON_BOX_STYLE =
  "display:inline-block;padding:8px 16px;border-radius:6px;border:1px dashed #adb5bd;color:#868e96;text-decoration:none;";

/** 文の中の目印 → 見出しの字(件名の行など、HTML でない所) */
export function markerText(text: string): string {
  return text.replace(MARKER, (_, label: string) => label);
}

/** 文字に目印があるか */
export function hasPreviewMarker(text: string): boolean {
  return text.includes(PREVIEW_MARKER_OPEN);
}

/**
 * 描いた HTML の目印を仮の枠に置き換える。
 * 1. 属性の値の中(alt・title など)= 見出しの字だけ(枠のタグを属性に入れない)
 * 2. 中身が目印だけのリンク(<a>)= 点線の枠(行き先を外す)
 * 3. 残り = 薄い地の枠
 * 見出しは描き方が HTML の字として書いた物(エスケープ済み)なのでそのまま使う
 */
export function replacePreviewMarkers(html: string): string {
  if (!hasPreviewMarker(html)) return html;
  const inAttributes = html.replace(/(=\s*")([^"]*)(")/g, (_, open: string, value: string, close: string) => `${open}${markerText(value)}${close}`);
  const links = inAttributes.replace(
    /<a\b[^>]*>((?:\s|<[^>]+>)*)\uE000([^\uE000\uE001]*)\uE001((?:\s|<\/?[^>]+>)*)<\/a>/g,
    (_, _before: string, label: string) => `<span data-preview-placeholder="button" style="${BUTTON_BOX_STYLE}">${label}</span>`,
  );
  return links.replace(MARKER, (_, label: string) => `<span data-preview-placeholder="text" style="${TEXT_BOX_STYLE}">${label}</span>`);
}
