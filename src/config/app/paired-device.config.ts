// src/config/app/paired-device.config.ts

/**
 * 登録端末（pairedDevice）の設定
 *
 * 店舗に置くタブレットやキオスクなどの共有端末を、ユーザーアカウントとは別の
 * 認証主体として登録し、長期の端末トークン（httpOnly Cookie）で動かす。
 * kind ごとの scope・管理権限・追加検証は src/features/core/pairedDevice/kinds/ の項目で宣言する。
 * 詳細: src/features/core/pairedDevice/README.md
 */
export const PAIRED_DEVICE_CONFIG = {
  /**
   * 機能の有効化。デフォルト無効（オプトイン）。
   * false の間は feature-gate がルートを 404 にし、db:push はテーブルを作らず、
   * 端末セッションの解決は Cookie を読まずに常に null を返す。
   */
  enabled: false,

  cookie: {
    /** 端末トークンを入れる Cookie 名（ユーザーセッションの Cookie とは別） */
    name: "paired_device",
    /** 端末側から始めるペアリングの、承認待ちを照合する Cookie 名 */
    pendingPairingName: "paired_device_pending",
  },

  token: {
    /**
     * 端末トークンの有効期間（日）。kind ごとに tokenMaxAgeDays で上書きできる。
     * 主要ブラウザは Cookie の寿命を 400 日で打ち切るため、それを上限の目安にする。
     */
    maxAgeDays: 400,
    /**
     * 残りがこの日数を切った状態で端末がアクセスすると有効期限を延長し、Cookie を再発行する。
     * 使われ続けている端末は失効しない（スライディング方式）
     */
    refreshWhenRemainingDays: 30,
    /**
     * 最後のアクセスからこの日数が経った端末を無効として扱う（null = 無効化しない）。
     * kind ごとに idleRevokeDays で上書きできる
     */
    idleRevokeDays: null as number | null,
  },

  /** lastSeenAt（最終アクセス時刻）の更新を間引く間隔（秒）。アクセスごとの書き込みを避ける */
  lastSeenThrottleSeconds: 300,

  /**
   * 「オンライン」とみなす最終アクセスからの経過秒数（管理一覧の表示用）。
   * lastSeenThrottleSeconds より大きくすること
   */
  onlineThresholdSeconds: 600,

  pairing: {
    /** ペアリングコードの文字数（Crockford Base32。8 文字 = 40 bit） */
    codeLength: 8,
    /** ペアリングコードの有効期間（分） */
    ttlMinutes: 10,
    /** 端末側から始めるペアリングで、端末が承認を確認しに来る間隔の目安（秒） */
    pollIntervalSeconds: 3,
  },
} as const;
