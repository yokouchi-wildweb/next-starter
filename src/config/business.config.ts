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

  /** サイト開設日（法的文書の制定日のデフォルト値として使用） */
  launchedAt: "20XX年X月X日",

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

  // === 決済情報 ===

  payment: {
    /** 利用可能な支払方法（カンマ区切りで列挙） */
    methods: "クレジット決済、銀行振込、コンビニ払い",
  },

  // === ロゴ設定 ===

  logo: {
    /** ロゴバリアント別パス（imgPath からの相対パス） */
    variants: {
      default: 'logos/default.png',
      light: 'logos/light.png',        // 白系（暗い背景用）
      dark: 'logos/dark.png',          // 黒系（明るい背景用）
      primary: 'logos/primary.png',    // プライマリカラー
      secondary: 'logos/secondary.png', // セカンダリカラー
      mono: 'logos/mono.png',          // モノクロ
    },
    /** デフォルトで使用するバリアント */
    defaultVariant: 'default' as const,
  },

  // === メール設定 ===

  mail: {
    /** デフォルト送信元アドレス */
    defaultFrom: "noreply@oripa-do.jp",

    /** デフォルト送信者名 */
    defaultFromName: "next-starter",
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
    },
    privacy: {
      // enactedAt: "20XX年X月X日",
      // lastUpdatedAt: "20XX年X月X日",
    },

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
