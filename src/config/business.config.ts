/**
 * 事業者・サービスの基本設定
 * サービス名、会社情報、法的ページ用の情報などを一元管理
 */
export const businessConfig = {
  // === サービス基本情報 ===

  /** サービス名（正式名称） */
  serviceName: "next-stater",

  /** サービス名（略称・ロゴ横やタイトルで使用） */
  serviceNameShort: "next-stater",

  /** サービスの説明文（meta descriptionなどで使用） */
  description: "next-starter is a Wildweb creation.",

  /** 短い説明文（titleなどで使用） */
  descriptionShort: "a Wildweb creation.",

  /** ドメイン名（プロトコルなし） */
  domain: "example.com",

  /** サイトURL（プロトコル付き） */
  url: "https://example.com",

  // === 運営会社情報 ===

  company: {
    /** 会社名（正式名称） */
    name: "Wildweb Tokyo",

    /** 代表者名 */
    representative: "代表者名",

    /** 郵便番号 */
    postalCode: "〒000-0000",

    /** 住所 */
    address: "東京都○○区○○1-2-3",

    /** 電話番号 */
    phone: "03-0000-0000",

    /** メールアドレス（サポート・お問い合わせ用） */
    email: "support@example.com",
  },

  // === 法的ページ用情報 ===

  legal: {
    /** 規約等の制定日 */
    enactedAt: "20XX年X月X日",

    /** 規約等の最終更新日 */
    lastUpdatedAt: "20XX年X月X日",

    /** 古物商許可番号（不要な場合は空文字） */
    antiqueLicense: "",
  },

  // === 決済情報 ===

  payment: {
    /** 利用可能な支払方法（カンマ区切りで列挙） */
    methods: "クレジット決済、銀行振込、コンビニ払い",
  },

  // === SNS・外部リンク（任意） ===

  social: {
    /** X（旧Twitter）のURL */
    twitter: "",

    /** InstagramのURL */
    instagram: "",

    /** LINE公式アカウントのURL */
    line: "",
  },
} as const;

/** 事業者設定の型 */
export type BusinessConfig = typeof businessConfig;
