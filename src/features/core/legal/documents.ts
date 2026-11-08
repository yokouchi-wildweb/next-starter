// src/features/core/legal/documents.ts — 差し込み済みの法務の文書を返す公開の口(設定の議会 D23)
// 読み手: (legal) の画面・fork の差し替え画面・版の route。文面の選び方(sample = 例文、own = 上書きの文面)と差し込みはここだけが持つ

import { business } from "@/business";
import type { BusinessValues } from "@/lib/business";
import type { LegalDocument, LegalSection } from "@/lib/structuredDocument/legal";
import { replaceVariables, type VariableMap } from "@/lib/structuredDocument";

import { LEGAL_CONFIG } from "./config";
import { LEGAL_DOCUMENT_KINDS, LICENSES_SECTION_ID, LAUNCH_DATE_DEFAULT_KINDS } from "./constants";
import { EXAMPLE_PRIVACY } from "./examples/privacy";
import { EXAMPLE_TERMS } from "./examples/terms";
import { EXAMPLE_TRADELAW } from "./examples/tradelaw";
import type { LegalConfig, LegalDocumentKind, LegalLicense } from "./types";

/** 上流の例文(sample のときに表示する) */
export const LEGAL_EXAMPLES: Record<LegalDocumentKind, LegalDocument> = {
  terms: EXAMPLE_TERMS,
  privacy: EXAMPLE_PRIVACY,
  tradelaw: EXAMPLE_TRADELAW,
};

/** 文面の {{NAME}} に差し込む値(事業の素性 @/business と legal の値) */
export function legalVariables(values: BusinessValues, config: Pick<LegalConfig, "paymentMethods">): VariableMap {
  return {
    SERVICE_NAME: values.serviceName,
    DOMAIN: values.domain,
    COMPANY_NAME: values.company.name,
    REPRESENTATIVE: values.company.representative,
    POSTAL_CODE: values.company.postalCode,
    ADDRESS: values.company.address,
    PHONE: values.company.phone,
    EMAIL: values.company.email,
    PAYMENT_METHODS: config.paymentMethods,
  };
}

/** 許認可の節の本文(1 件 = 太字の表示名 + 詳細の行) */
function licenseContent(licenses: LegalLicense[]): string[] {
  return licenses.flatMap((license) => [`**${license.label}**`, ...license.details.map((d) => (d.key ? `${d.key}: ${d.value}` : d.value))]);
}

function fillSection(section: LegalSection, variables: VariableMap): LegalSection {
  return {
    ...section,
    ...(section.title !== undefined ? { title: replaceVariables(section.title, variables) } : {}),
    ...(section.content ? { content: section.content.map((text) => replaceVariables(text, variables)) } : {}),
    ...(section.children ? { children: section.children.map((child) => fillSection(child, variables)) } : {}),
  };
}

/**
 * 文書を選んで差し込む(純関数。getLegalDocument が今の設定と @/business で呼ぶ)
 * - 文面: sample = 例文、own = 上書きの文面
 * - id "licenses" の節: 中身を licenses の欄で埋める。欄が空なら節ごと外す
 * - 制定日: 利用規約・プライバシーポリシーは文面に enactedAt が無ければ事業の素性の launchedAt
 */
export function buildLegalDocument(
  kind: LegalDocumentKind,
  config: LegalConfig,
  values: BusinessValues,
  examples: Record<LegalDocumentKind, LegalDocument> = LEGAL_EXAMPLES,
): LegalDocument {
  const entry = config.documents[kind];
  const source = entry.source === "own" ? entry.document : examples[kind];
  const variables = legalVariables(values, config);
  const sections = source.sections.flatMap((section) => {
    if (section.id !== LICENSES_SECTION_ID) return [section];
    return config.licenses.length > 0 ? [{ ...section, content: licenseContent(config.licenses) }] : [];
  });
  const enactedAt = source.enactedAt ?? (LAUNCH_DATE_DEFAULT_KINDS.includes(kind) ? values.launchedAt : undefined);
  return {
    ...source,
    title: replaceVariables(source.title, variables),
    sections: sections.map((section) => fillSection(section, variables)),
    ...(enactedAt !== undefined ? { enactedAt } : {}),
  };
}

/** 差し込み済みの文書(今の legal の設定と @/business から) */
export function getLegalDocument(kind: LegalDocumentKind): LegalDocument {
  return buildLegalDocument(kind, LEGAL_CONFIG, business);
}

/** 制定日・最終改定日の行の文言(LegalDocumentRenderer の enactedAtFormat に渡す) */
export function getLegalEnactedAtFormat(): LegalConfig["enactedAtFormat"] {
  return LEGAL_CONFIG.enactedAtFormat;
}

/** sample のままの文書の種類(本番の検査 checkLegalRelease が読む) */
export function sampleLegalDocuments(config: Pick<LegalConfig, "documents"> = LEGAL_CONFIG): LegalDocumentKind[] {
  return LEGAL_DOCUMENT_KINDS.filter((kind) => config.documents[kind].source === "sample");
}
