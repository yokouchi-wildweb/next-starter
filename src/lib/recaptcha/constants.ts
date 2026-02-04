// src/lib/recaptcha/constants.ts

/**
 * reCAPTCHA 内部設定
 *
 * これらの値はシステム内部で使用され、ユーザーが変更すべきではない。
 * スコア閾値（threshold）は APP_FEATURES で設定する。
 *
 * v3: スコアベースの自動判定（メイン）
 * v2: チャレンジベースの手動認証（v3で中間スコアの場合のフォールバック）
 */

/**
 * reCAPTCHAアクション名
 * スコア分析時に識別子として使用される
 */
export const RECAPTCHA_ACTIONS = {
  /** メール認証リンク送信 */
  SEND_EMAIL_LINK: "send_email_link",
  /** 本登録 */
  REGISTER: "register",
} as const;

export type RecaptchaAction = (typeof RECAPTCHA_ACTIONS)[keyof typeof RECAPTCHA_ACTIONS];

/** reCAPTCHAキーの最低文字数（有効なキーは通常40文字程度） */
const MIN_KEY_LENGTH = 20;

/**
 * reCAPTCHA v3 内部設定
 */
export const RECAPTCHA_V3_INTERNALS = {
  /** reCAPTCHA v3 サイトキー（クライアント用） */
  siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY ?? "",

  /** reCAPTCHA v3 シークレットキー（サーバー用） */
  secretKey: process.env.RECAPTCHA_V3_SECRET_KEY ?? "",

  /** 検証APIのURL */
  verifyUrl: "https://www.google.com/recaptcha/api/siteverify",

  /** サイトキーが有効か（空や短すぎる値は無効） */
  get hasSiteKey(): boolean {
    return this.siteKey.length >= MIN_KEY_LENGTH;
  },

  /** シークレットキーが有効か（空や短すぎる値は無効） */
  get hasSecretKey(): boolean {
    return this.secretKey.length >= MIN_KEY_LENGTH;
  },

  /** reCAPTCHA v3を有効にするか（両方のキーが有効な場合のみ有効） */
  get enabled(): boolean {
    return this.hasSiteKey && this.hasSecretKey;
  },
} as const;

/**
 * reCAPTCHA v2 内部設定
 */
export const RECAPTCHA_V2_INTERNALS = {
  /** reCAPTCHA v2 サイトキー（クライアント用） */
  siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ?? "",

  /** reCAPTCHA v2 シークレットキー（サーバー用） */
  secretKey: process.env.RECAPTCHA_V2_SECRET_KEY ?? "",

  /** 検証APIのURL */
  verifyUrl: "https://www.google.com/recaptcha/api/siteverify",

  /** サイトキーが有効か（空や短すぎる値は無効） */
  get hasSiteKey(): boolean {
    return this.siteKey.length >= MIN_KEY_LENGTH;
  },

  /** シークレットキーが有効か（空や短すぎる値は無効） */
  get hasSecretKey(): boolean {
    return this.secretKey.length >= MIN_KEY_LENGTH;
  },

  /** reCAPTCHA v2を有効にするか（両方のキーが有効な場合のみ有効） */
  get enabled(): boolean {
    return this.hasSiteKey && this.hasSecretKey;
  },
} as const;

/**
 * @deprecated RECAPTCHA_V3_INTERNALS を使用してください
 */
export const RECAPTCHA_INTERNALS = RECAPTCHA_V3_INTERNALS;
