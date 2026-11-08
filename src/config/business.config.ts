// src/config/business.config.ts — 古い置き場の殻(締め 2 で消す。新しい読み手を足さない)
// 事業の素性の正本は @/business(src/business/business.ts、決まり: src/lib/business/README.md)。この殻は @/business の値を写し、
// 法務だけが読む値(決済方法の表示・規約とポリシーの日付・許認可)を legal の指令まで持つ(設定の議会 D88)。
// 読み手: lib/mail・lib/url・seo.config.ts(lib は @/business を直に読まない。lib の設定の上書きが写す形は棚の lib を閉じるクエスト)と src/config/documents
import { business } from "@/business";
import type { LegalDocumentDates } from "@/lib/structuredDocument/legal";

/**
 * 許認可情報の詳細項目
 * keyを省略した場合はvalueのみ表示
 */
type LicenseDetail = { key?: string; value: string };

/**
 * 許認可情報
 */
type License = {
  /** 識別子（固有処理が必要な場合に使用） */
  type: string;
  /** 表示名 */
  label: string;
  /** 詳細情報（キーバリュー配列） */
  details: LicenseDetail[];
};

/**
 * 事業者・サービスの基本設定(殻)。@/business の値 + 法務だけが読む値
 */
export const businessConfig = {
  ...business,

  // === 決済情報 ===

  payment: {
    /** 利用可能な支払方法（カンマ区切りで列挙） */
    methods: "クレジット決済、銀行振込、コンビニ払い",
  },

  // === 法的ページ用情報 ===

  legal: {
    /**
     * 文書ごとの日付設定（すべて省略可）
     * - enactedAt: 制定日（省略時は launchedAt を使用）
     * - lastUpdatedAt: 最終更新日（省略時は非表示）
     */
    terms: {
      // enactedAt: "20XX年X月X日",
      // lastUpdatedAt: "20XX年X月X日",
    } as LegalDocumentDates,
    privacy: {
      // enactedAt: "20XX年X月X日",
      // lastUpdatedAt: "20XX年X月X日",
    } as LegalDocumentDates,

    /**
     * 許認可・法的情報のリスト
     * - type: 識別子（必須）
     * - label: 表示名（必須）
     * - details: キーバリュー配列（keyは省略可、省略時はvalueのみ表示）
     */
    licenses: [
      // 例: 古物商許可
      // {
      //   type: "antique",
      //   label: "古物商許可",
      //   details: [
      //     { key: "許可番号", value: "第000000000号" },
      //     { key: "交付", value: "東京都公安委員会" },
      //     { value: "20XX年X月X日" },
      //   ],
      // },
    ] as License[],
  },
} as const;

/** 事業者設定の型 */
export type BusinessConfig = typeof businessConfig;

/** 許認可情報の型（再エクスポート） */
export type { License, LicenseDetail };
