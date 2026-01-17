import type { LegalSectionNumbering } from "../definition";

/**
 * セクションタイトルに番号を付与する（プレーンテキスト用）
 *
 * @param title セクションタイトル
 * @param index セクションのインデックス（0始まり）
 * @param numbering 番号スタイル
 */
export function formatSectionTitle(
  title: string,
  index: number,
  numbering: LegalSectionNumbering
): string {
  switch (numbering) {
    case "article":
      return `第${index + 1}条 ${title}`;
    case "numeric":
      return `${index + 1}. ${title}`;
    case "none":
    default:
      return title;
  }
}

/**
 * Markdownのリンク記法を除去してプレーンテキストにする
 *
 * @example
 * stripMarkdownLinks("[こちら](https://example.com)をご確認ください")
 * // => "こちらをご確認ください"
 */
export function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/**
 * 基本的なMarkdown記法を除去してプレーンテキストにする
 * - リンク: [text](url) => text
 * - 太字: **text** => text
 * - 斜体: *text* => text
 * - 取り消し線: ~~text~~ => text
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // リンク
    .replace(/\*\*([^*]+)\*\*/g, "$1") // 太字
    .replace(/\*([^*]+)\*/g, "$1") // 斜体
    .replace(/~~([^~]+)~~/g, "$1"); // 取り消し線
}

/**
 * 番号スタイルに対応するCSSクラス名を取得する
 */
export function getNumberingClassName(
  numbering: LegalSectionNumbering
): string {
  switch (numbering) {
    case "article":
      return "numbered-articles";
    case "numeric":
      return "numbered-sections";
    case "none":
    default:
      return "";
  }
}
