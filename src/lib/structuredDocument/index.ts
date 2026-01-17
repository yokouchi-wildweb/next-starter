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

// --- 後方互換性のためのエイリアス（非推奨） ---
// 新規コードでは legal/ から直接インポートしてください

/** @deprecated LegalDocument を使用してください */
export type { LegalDocument as StructuredDocument } from "./legal";
/** @deprecated LegalSection を使用してください */
export type { LegalSection as DocumentSection } from "./legal";
/** @deprecated LegalSectionNumbering を使用してください */
export type { LegalSectionNumbering as SectionNumbering } from "./legal";
/** @deprecated LegalRenderMode を使用してください */
export type { LegalRenderMode as RenderMode } from "./legal";
/** @deprecated LegalDocumentRendererProps を使用してください */
export type { LegalDocumentRendererProps as StructuredDocumentRendererProps } from "./legal";
/** @deprecated LegalDocumentRenderer を使用してください */
export { LegalDocumentRenderer as StructuredDocumentRenderer } from "./legal";
