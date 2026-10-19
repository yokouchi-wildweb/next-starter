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
 * } from "@/lib/structuredDocument/legal";
 */

// 共通ユーティリティ
export type { VariableMap } from "./shared";
export { replaceVariables, replaceVariablesInArray } from "./shared";

// リーガルドキュメント（再エクスポート）
export type {
  LegalDocument,
  LegalDocumentRendererProps,
  LegalRenderMode,
  LegalSection,
  LegalSectionNumbering,
} from "./legal";
export { LegalDocumentRenderer } from "./legal";
