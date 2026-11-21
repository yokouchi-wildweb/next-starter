// src/lib/recaptcha/constants.ts

/**
 * reCAPTCHA 内部設定
 *
 * これらの値はシステム内部で使用され、ユーザーが変更すべきではない。
 * スコア閾値（threshold）の既定は lib/routeFactory の設定（上書き src/config/lib/routeFactory.config.ts）。
 * キー(サイトキー・シークレット)は設定 config.ts(上書き src/config/lib/recaptcha.config.ts)。この lib の中では env を読まない。
 *
 * v3: スコアベースの自動判定（メイン）
 * v2: チャレンジベースの手動認証（v3で中間スコアの場合のフォールバック）
 */

/**
 * reCAPTCHA デバッグ設定
 *
 * 開発環境でのテスト用。本番環境では必ず無効にすること。
 */
export const RECAPTCHA_DEBUG = {
  /** デバッグログを出力するか */
  enabled: false,

  /**
   * スコアを強制的に上書きする値
   * - null: 上書きしない（実際のスコアを使用）
   * - 0.0〜1.0: 指定した値で上書き
   */
  forceScore: null as number | null,
} as const;

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
export const RECAPTCHA_MIN_KEY_LENGTH = 20;

/** 検証APIのURL（v3 / v2 共通） */
export const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
