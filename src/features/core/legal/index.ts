// src/features/core/legal — 法務の文書(利用規約・プライバシーポリシー・特定商取引法に基づく表示)。表は持たない。中身: ./README.md
// 読み手は差し込み済みの文書 getLegalDocument を使う(設定 LEGAL_CONFIG を直に読まない)。import は core/ を省いた別名 @/features/legal/<file>

export { buildLegalDocument, getLegalDocument, getLegalEnactedAtFormat, LEGAL_EXAMPLES, legalVariables, sampleLegalDocuments } from "./documents";
export { checkLegalRelease } from "./release";
export { LEGAL_DOCUMENT_KINDS } from "./constants";
export type { LegalConfig, LegalDocumentEntry, LegalDocumentKind, LegalLicense, LegalLicenseDetail } from "./types";
