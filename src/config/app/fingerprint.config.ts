// src/config/app/fingerprint.config.ts

/**
 * ブラウザフィンガープリント基盤（deviceFingerprint / fingerprintChallenge）の設定
 *
 * 目的: 複数アカウント運用などの不正が疑われるユーザーを「デバイス軸」で
 * 突き合わせるための一次データ収集。userLoginEvent（IP = ネットワーク軸）の
 * 兄弟基盤で、両者を組み合わせて調査する（各 README の調査レシピ参照）。
 *
 * 注意: フィンガープリントはクライアント申告値であり偽装可能。
 * 「断定材料」ではなく「参考証拠」として扱うこと（詳細は
 * src/features/core/deviceFingerprint/README.md の脅威モデル）。
 */
export const FINGERPRINT_CONFIG = {
  /**
   * 全ページ設置型の収集（useFingerprintReport → POST /api/me/fingerprint）。
   * デフォルト無効。downstream で複垢検知が必要になったら true にする（オプトイン）。
   * 有効化した時点以降のアクセスから蓄積される（過去には遡及できない）。
   */
  collection: {
    enabled: false,

    /** device_fingerprints 行の既定保持期間（日）。行単位 retention + 日次 cron prune */
    retentionDays: 365,

    /**
     * raw_signals (正規化前の生信号 JSONB) の保存上限バイト数。
     * 超過時は行自体は保存しつつ raw_signals のみ null に落とす
     * （検索軸のハッシュ列は常に保存される）。
     */
    maxRawSignalsBytes: 32768,
  },

  /**
   * 不正疑いユーザーへの回答チャレンジ（fingerprintChallenge）。
   * collection.enabled とは独立したゲート（チャレンジ提出時の
   * フィンガープリント記録はこちらの enabled のみで動く）。
   */
  challenge: {
    enabled: false,

    /** 発行時に expiresInDays 未指定だった場合の既定有効期間（日） */
    defaultExpiresInDays: 7,

    /** behavior (行動計測 payload JSONB) の保存上限バイト数。超過時は null に落とす */
    maxBehaviorBytes: 32768,
  },
} as const;
