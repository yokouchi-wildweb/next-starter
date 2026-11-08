// src/features/core/legal/types.ts — 法務の文書の型(設定の議会 D21・D23・L1.24)

import type { LegalDocument, LegalEnactedAtFormat } from "@/lib/structuredDocument/legal";

/** 法務の文書の種類(利用規約・プライバシーポリシー・特定商取引法に基づく表示) */
export type LegalDocumentKind = "terms" | "privacy" | "tradelaw";

/**
 * 文書ごとの印と文面(business の受付係と同じ形、D88・L1.24)
 * - sample = 上流の例文(examples/<kind>.ts)を表示する。上流はこれで出荷する。本番のビルドは pnpm check legal が止める(Tier1 は警告)
 * - own = このプロジェクトの文面。document は全部の欄が型で必須(日付 enactedAt / lastUpdatedAt は文面に書く)
 */
export type LegalDocumentEntry = { source: "sample" } | { source: "own"; document: LegalDocument };

/** 許認可の詳細の 1 行(key を省くと value だけを表示) */
export type LegalLicenseDetail = { key?: string; value: string };

/** 許認可(特定商取引法に基づく表示の「関連法令に基づく許認可」の節に出す) */
export type LegalLicense = {
  /** 識別子 */
  type: string;
  /** 表示名 */
  label: string;
  /** 詳細の行 */
  details: LegalLicenseDetail[];
};

/** legal の設定(既定は config.ts、上書きは src/config/features/legal.config.ts) */
export type LegalConfig = {
  /** 文書ごとの印と文面 */
  documents: Record<LegalDocumentKind, LegalDocumentEntry>;
  /** 利用可能な支払方法の表示(文面の {{PAYMENT_METHODS}} に差し込む) */
  paymentMethods: string;
  /** 許認可の一覧(空なら特定商取引法に基づく表示の許認可の節を外す) */
  licenses: LegalLicense[];
  /** 制定日・最終改定日の行の文言(空 = lib/structuredDocument の Renderer の既定) */
  enactedAtFormat: LegalEnactedAtFormat;
};
