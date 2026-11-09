// src/features/core/fingerprintChallenge/config.ts
// 不正疑いユーザーへの回答チャレンジ(fingerprintChallenge)の設定(既定 + 上書き)。上書きは src/config/features/fingerprintChallenge.config.ts
// (このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig。
// 使うかどうか(opt-in、既定は閉)は門番の規則 src/featureGate/rules/fingerprintChallenge.ts の入切だけで決める(この設定に入切の鍵は無い)。
// 規則は収集の規則 deviceFingerprint に依存する(照合は集めた指紋が要る)。開けるのは fork の src/config/featureGate/switches.config.ts

import override from "@/config/features/fingerprintChallenge.config";
import type { UserStatus } from "@/features/user/types";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type FingerprintChallengeConfig = {
  challenge: {
    /**
     * 本人向けルート(/api/me/fingerprint-challenges/**)の回答を許可するユーザーステータス。
     * チャレンジの主対象は「処分保留 (suspended)」のユーザーなので既定で含める。
     * banned / security_locked / withdrawn は列挙しない限り 403(fail-closed)。
     * 語彙は createMeRoute / ページの守り(guard.ts)の allowStatuses と同じ。
     */
    answerableStatuses: readonly UserStatus[];
    /** 発行時に expiresInDays 未指定だった場合の既定有効期間(日) */
    defaultExpiresInDays: number;
    /** behavior (行動計測 payload JSONB) の保存上限バイト数。超過時は null に落とす */
    maxBehaviorBytes: number;
    /**
     * 「ユーザーがチャレンジを開いたか」の計測 (アクセスログ)。
     * 本人向け取得ルート (GET /api/me/fingerprint-challenges/[token] | /pending) の読み取り時に、
     * first/last_viewed_at + view_count の更新と fingerprint_challenge_access_events (IP + UA のタイムライン) の追記を行う。
     * デフォルト無効 (オプトイン)。有効化した時点以降のアクセスから蓄積される。記録失敗は読み取りを阻害しない (fail-soft)。
     */
    accessLog: {
      enabled: boolean;
      /**
       * 同一チャレンジへの連続アクセスをまとめる窓 (秒)。last_viewed_at からこの秒数以内の
       * 再アクセスは view_count を増やさずイベントも追記しない (リロード連打の抑制)。0 で全アクセスを記録。
       */
      dedupeSeconds: number;
      /** fingerprint_challenge_access_events 行の保持期間 (日)。IP を含むため無期限保持にしない */
      retentionDays: number;
    };
  };
};

const defaults: FingerprintChallengeConfig = {
  challenge: {
    answerableStatuses: ["active", "suspended"],
    defaultExpiresInDays: 7,
    maxBehaviorBytes: 32768,
    accessLog: {
      enabled: false,
      dedupeSeconds: 60,
      retentionDays: 90,
    },
  },
};

export const fingerprintChallengeConfigDef = defineConfig(defaults, { label: "fingerprintChallenge" });

/** 上書きのファイルの型(`export default { ... } satisfies FingerprintChallengeOverride`) */
export type FingerprintChallengeOverride<E extends object = Record<never, never>> = OverrideOf<typeof fingerprintChallengeConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const fingerprintChallengeConfig: FingerprintChallengeConfig = fingerprintChallengeConfigDef.compose(override);
