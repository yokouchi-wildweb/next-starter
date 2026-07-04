// src/config/app/rate-limit.config.ts

/**
 * レート制限ルール設定
 * カテゴリごとに制限ルールを定義
 */
export const RATE_LIMIT_CONFIG = {
  /**
   * サインアップ: メール送信系
   * 同一IPから1時間に7回まで
   */
  signupEmail: {
    windowSeconds: 3600,
    maxRequests: 7,
  },

  /**
   * サインアップ: 登録系（IP単位）
   * 同一IPから1時間に3回まで
   * ※ signupSubnet とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  signupRegister: {
    windowSeconds: 3600,
    maxRequests: 3,
  },

  /**
   * サインアップ: 登録系（サブネット /24 単位）
   * 同一サブネットから10分に3回まで
   * iCloud Private Relay 等でIPが分散する攻撃への対策
   * ※ signupRegister とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  signupSubnet: {
    windowSeconds: 600,
    maxRequests: 3,
  },

  /**
   * ログイン試行
   * 同一IPから15分に5回まで
   * ※ loginSubnet とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  login: {
    windowSeconds: 900,
    maxRequests: 5,
  },

  /**
   * ログイン試行（サブネット /24 単位）
   * 同一サブネットから15分に20回まで
   * iCloud Private Relay やボットネット等でIPが分散する攻撃への対策
   * ※ login とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  loginSubnet: {
    windowSeconds: 900,
    maxRequests: 20,
  },

  /**
   * パスワードリセット
   * 同一IPから1時間に3回まで
   */
  passwordReset: {
    windowSeconds: 3600,
    maxRequests: 3,
  },

  /**
   * 汎用API（一覧取得など）
   * 同一IPから1分に60回まで
   */
  apiGeneral: {
    windowSeconds: 60,
    maxRequests: 60,
  },

  /**
   * インタラクション計測 ingest（POST /api/interactions）
   * 同一IPから1分に60回まで
   * ※ interactionIngestSubnet とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  interactionIngest: {
    windowSeconds: 60,
    maxRequests: 60,
  },

  /**
   * インタラクション計測 ingest（サブネット /24 単位）
   * 同一サブネットから1分に300回まで
   * IPが分散するボット等によるカウント水増しへの対策
   * ※ interactionIngest とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  interactionIngestSubnet: {
    windowSeconds: 60,
    maxRequests: 300,
  },
} as const;

export type RateLimitCategory = keyof typeof RATE_LIMIT_CONFIG;
