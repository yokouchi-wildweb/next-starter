// src/lib/business/types.ts — 事業の素性の型(設定の議会 D20・D66・D88)

/** ロゴの種類(画像は imgPath からの相対パス) */
export type LogoVariant = "default" | "light" | "dark" | "primary" | "secondary" | "mono";

/** 事業の素性の値(own のときは全部の欄が必須) */
export type BusinessValues = {
  /** サービス名(正式名称) */
  serviceName: string;
  /** サービス名(略称・ロゴ横やタイトルで使う) */
  serviceNameShort: string;
  /** サービスの説明文(meta description などで使う) */
  description: string;
  /** 短い説明文(title などで使う) */
  descriptionShort: string;
  /** ドメイン名(プロトコルなし) */
  domain: string;
  /** 公式のサイト URL(プロトコル付き。メール・SEO 用。実行時の origin は @/lib/url の getAppBaseUrl) */
  url: string;
  /** サイト開設日(法的文書の制定日の既定に使う) */
  launchedAt: string;
  /** 運営会社 */
  company: {
    /** 会社名(正式名称) */
    name: string;
    /** 代表者名 */
    representative: string;
    /** 郵便番号 */
    postalCode: string;
    /** 住所 */
    address: string;
    /** 電話番号 */
    phone: string;
    /** メールアドレス(サポート・お問い合わせ用) */
    email: string;
  };
  /** ロゴ(種類ごとのパスと既定の種類。枠ごとに違うロゴは枠の設定で種類を選ぶ、D66) */
  logo: {
    variants: Record<LogoVariant, string>;
    defaultVariant: LogoVariant;
  };
  /** サイトの言語(<html lang>、例 "ja") */
  htmlLang: string;
  /** SEO・OGP の既定(サイト名・URL・説明は serviceNameShort・url・description から作る) */
  seo: {
    /** 既定の OGP 画像のパス(絶対か / 始まりの相対) */
    defaultOgImage: string;
    /** OGP 画像の大きさ */
    ogImageSize: { width: number; height: number };
    /** OGP のロケール(例 "ja_JP") */
    locale: string;
    /** X(旧 Twitter)のアカウント(@ なし、空なら出さない) */
    twitterHandle: string;
  };
  /** メールの既定の送信元 */
  mail: {
    defaultFrom: string;
    defaultFromName: string;
  };
};

/**
 * src/business/business.ts の形。
 * - sample = 上流の出荷の状態。@/business は例の値(src/lib/business/examples/business.ts)を返す。本番のビルドは止まる(Tier1 は警告)
 * - own = このプロジェクトの値。values の全部の欄が必須(書き忘れは tsc で落ちる)
 */
export type BusinessFile = { source: "sample" } | { source: "own"; values: BusinessValues };

/** 印の値 */
export type BusinessSource = BusinessFile["source"];
