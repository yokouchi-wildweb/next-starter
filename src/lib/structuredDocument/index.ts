/**
 * 構造化ドキュメントライブラリ
 *
 * 文書タイプごとにサブディレクトリで管理:
 * - legal: 利用規約、プライバシーポリシー、特商法表記など
 * - qa: Q&A、FAQ（将来）
 * - guide: ガイド・チュートリアル（将来）
 *
 * @example
 * // リーガルドキュメント
 * import {
 *   LegalDocumentRenderer,
 *   type LegalDocument,
 * } from "@/lib/structuredDocument";
 */

// 入口 "." だけ(閉じた lib)。リーガルドキュメント(legal/)の構造の型・描画・整形の関数を出す。
// 差し込みの変数(replaceVariables など)は lib templateVariables(@/lib/templateVariables)

export type {
  LegalDocument,
  LegalDocumentDates,
  LegalDocumentRendererProps,
  LegalEnactedAtFormat,
  LegalRenderMode,
  LegalSection,
  LegalSectionNumbering,
} from "./legal";
export { LegalDocumentRenderer, formatSectionTitle, getNumberingClassName, stripMarkdown, stripMarkdownLinks } from "./legal";
