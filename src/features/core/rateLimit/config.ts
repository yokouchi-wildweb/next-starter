// src/features/core/rateLimit/config.ts
// レート制限のカテゴリと制限の値(既定 + 上書き、設定の議会 L1.25)。上書きは src/config/features/rateLimit.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。fork はカテゴリの値を変え、自分のカテゴリを足せる:
// 足すカテゴリは上書きのファイルで `export type Extra = { <名前>: RateLimitRule }` を宣言し、値を書く(RateLimitCategory に入る)。
// カテゴリの名前の型 RateLimitCategory は src/wiring/apiRoute.ts が lib/routeFactory に型引数で渡す(lib は features の型を読まない)

import override, { type Extra } from "@/config/features/rateLimit.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 1 カテゴリの制限: windowSeconds 秒の窓に maxRequests 回まで */
export type RateLimitRule = {
  /** 窓の長さ(秒) */
  windowSeconds: number;
  /** 窓の中で許す回数 */
  maxRequests: number;
};

const defaults = {
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
   * ゲスト(デモ)ログイン（POST /api/auth/guest-login）
   * 同一IPから1時間に5回まで
   * 認証不要・確認手段なしでデモユーザーを量産できてしまうため制限する
   */
  guestLogin: {
    windowSeconds: 3600,
    maxRequests: 5,
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

  /**
   * インタラクション計測バッチ ingest（POST /api/interactions/batch）
   * 同一IPから1分に20回まで
   * クライアント側で集約して送る前提のため、正常利用では数十秒に1回しか飛ばない
   * ※ interactionBatchSubnet とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  interactionBatch: {
    windowSeconds: 60,
    maxRequests: 20,
  },

  /**
   * インタラクション計測バッチ ingest（サブネット /24 単位）
   * 同一サブネットから1分に120回まで
   * IPが分散するボット等によるカウント水増しへの対策
   * ※ interactionBatch とハイブリッドで併用（どちらか先に到達した方で制限）
   */
  interactionBatchSubnet: {
    windowSeconds: 60,
    maxRequests: 120,
  },

  /**
   * 登録端末: ペアリングコードの入力（POST /api/paired-device/pairing/claim）
   * 同一IPから10分に100回まで。コードは8文字（40bit）・10分で失効なので、この上限で総当たりは成り立たない。
   * 店舗の端末は同じIPから来るため、設置時に数台まとめて登録しても当たらない値にしている
   */
  pairedDeviceClaim: {
    windowSeconds: 600,
    maxRequests: 100,
  },

  /**
   * 登録端末: 端末側からのペアリング開始（POST /api/paired-device/pairing/start）
   * 同一IPから10分に20回まで。未認証で承認待ちの行を作るルートなので絞る（fork の運用に合わせて調整）
   */
  pairedDevicePairingStart: {
    windowSeconds: 600,
    maxRequests: 20,
  },

  /**
   * 登録端末: 承認の確認（POST /api/paired-device/pairing/status）、照合トークン単位
   * 1つのペアリングにつき1分に60回まで（既定の確認間隔3秒 = 20回/分の3倍）
   */
  pairedDevicePairingPoll: {
    windowSeconds: 60,
    maxRequests: 60,
  },

  /**
   * 登録端末: 承認の確認、同一IPの上限
   * 1分に600回まで。店内の端末は同じIPから来るので、照合トークン単位の制限とは別に緩くかける
   */
  pairedDevicePairingPollIp: {
    windowSeconds: 60,
    maxRequests: 600,
  },

  /**
   * 登録端末: 管理者による承認・承認情報の取得（/api/paired-devices/pairing-requests/**）、ユーザー単位
   * 10分に60回まで（コードを当て推量で引くのを防ぐ）
   */
  pairedDeviceManage: {
    windowSeconds: 600,
    maxRequests: 60,
  },

  /**
   * 登録端末: 管理者による承認・承認情報の取得、同一IPの上限
   * 10分に300回まで（ユーザー単位の制限とは別に緩くかける）
   */
  pairedDeviceManageIp: {
    windowSeconds: 600,
    maxRequests: 300,
  },

  /**
   * 管理者の初回セットアップ（POST /api/setting/setup。未認証・管理者が1人でもいれば 409）
   * 同一IPから1時間に10回まで。入力ミスでも回数を消費するため signupRegister（3回）より緩くする
   */
  adminSetup: {
    windowSeconds: 3600,
    maxRequests: 10,
  },

  /**
   * ファイルのアップロード権の発行（POST /api/me/storage/uploads）
   * 同一IPから1分に30回まで。未完了の数は用途ごとの maxPending でも別に絞る
   */
  storageIssue: {
    windowSeconds: 60,
    maxRequests: 30,
  },
} satisfies Record<string, RateLimitRule>;

/** 上流のカテゴリと制限 */
export type RateLimitDefaults = { [K in keyof typeof defaults]: RateLimitRule };

export const rateLimitConfigDef = defineConfig<RateLimitDefaults>(defaults, { label: "rateLimit" });

/** 上書きのファイルの型(`export default { ... } satisfies RateLimitOverride<Extra>`) */
export type RateLimitOverride<E extends object = Record<never, never>> = OverrideOf<typeof rateLimitConfigDef, E>;

/** 合成済みの設定(上流のカテゴリ + 上書きで足したカテゴリ) */
export const RATE_LIMIT_CONFIG = rateLimitConfigDef.compose<Extra>(override);

/** レート制限のカテゴリの名前(上流 + 上書きの Extra) */
export type RateLimitCategory = keyof typeof RATE_LIMIT_CONFIG & string;
