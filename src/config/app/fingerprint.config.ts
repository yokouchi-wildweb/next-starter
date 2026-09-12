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

    /**
     * 本人向けルート（/api/me/fingerprint-challenges/**）の回答を許可するユーザーステータス。
     * チャレンジの主対象は「処分保留 (suspended)」のユーザーなので既定で含める。
     * banned / security_locked / withdrawn は列挙しない限り 403（fail-closed）。
     * 語彙は createMeRoute / authGuard の allowStatuses と同じ。
     */
    answerableStatuses: ["active", "suspended"],

    /** 発行時に expiresInDays 未指定だった場合の既定有効期間（日） */
    defaultExpiresInDays: 7,

    /** behavior (行動計測 payload JSONB) の保存上限バイト数。超過時は null に落とす */
    maxBehaviorBytes: 32768,

    /**
     * 「ユーザーがチャレンジを開いたか」の計測 (アクセスログ)。
     * 本人向け取得ルート (GET /api/me/fingerprint-challenges/[token] | /pending) の
     * 読み取り時に、first/last_viewed_at + view_count の更新と
     * fingerprint_challenge_access_events (IP + UA のタイムライン) の追記を行う。
     * デフォルト無効 (オプトイン)。有効化した時点以降のアクセスから蓄積される。
     * 記録失敗は読み取りを阻害しない (fail-soft)。
     */
    accessLog: {
      enabled: false,

      /**
       * 同一チャレンジへの連続アクセスをまとめる窓 (秒)。last_viewed_at からこの秒数以内の
       * 再アクセスは view_count を増やさずイベントも追記しない (リロード連打の抑制)。
       * 0 で全アクセスを記録。
       */
      dedupeSeconds: 60,

      /** fingerprint_challenge_access_events 行の保持期間 (日)。IP を含むため無期限保持にしない */
      retentionDays: 90,
    },
  },
} as const;
