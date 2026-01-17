/**
 * リーガルドキュメント
 *
 * 利用規約、プライバシーポリシー、特商法表記など
 * 階層構造を持つ法的文書を扱うためのモジュール
 *
 * @example
 * import {
 *   LegalDocumentRenderer,
 *   type LegalDocument,
 * } from "@/lib/structuredDocument/legal";
 *
 * const termsConfig: LegalDocument = {
 *   title: "利用規約",
 *   sectionNumbering: "article",
 *   sections: [
 *     { content: ["前文..."] },
 *     { id: "article-1", title: "適用", content: ["1. 本規約は..."] },
 *   ],
 * };
 *
 * <LegalDocumentRenderer
 *   document={termsConfig}
 *   variables={{ COMPANY_NAME: "株式会社Example" }}
 * />
 */

// 構造定義
export type {
  LegalDocument,
  LegalDocumentRendererProps,
  LegalRenderMode,
  LegalSection,
  LegalSectionNumbering,
} from "./definition";

// レンダラー
export { LegalDocumentRenderer } from "./Renderer";

// ユーティリティ
export {
  formatSectionTitle,
  getNumberingClassName,
  stripMarkdown,
  stripMarkdownLinks,
} from "./Renderer/utils";
