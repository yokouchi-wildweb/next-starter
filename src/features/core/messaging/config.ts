// src/features/core/messaging/config.ts
// 連絡(messaging)の処理の値(既定 + 上書き)。上書きは src/config/features/messaging.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。入切のスイッチではなく、送る口の処理の数。

import override from "@/config/features/messaging.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type MessagingConfig = {
  /**
   * 小さな送信の上限(選んだ利用者の人数)。これ以下は要求の中で展開して最初の束を送る。
   * これを超える送信と audiences・全員・ロール宛ては回の行だけを書き、展開と送信は cron に任せる
   */
  smallSendMaxRecipients: number;
  /** 要求の中で送る最初の束の配達の行の数(残りは queued のまま cron が送る) */
  inRequestBatchSize: number;
  /** required の連絡の要求の中の再送(一時の失敗だけ)。attempts = 初回を含む回数、delaysMs = 試行の間の待ち */
  requiredRetry: { attempts: number; delaysMs: readonly number[] };
  /** 非 required の一時の失敗の再送(cron が next_attempt_at で拾う)。maxAttempts = 初回を含む回数 */
  transientRetry: { maxAttempts: number; baseDelaySeconds: number; factor: number };
  /** 全員・ロール・audiences の展開の 1 束の人数(cron が使う) */
  expandChunkSize: number;
};

const defaults: MessagingConfig = {
  smallSendMaxRecipients: 100,
  inRequestBatchSize: 50,
  requiredRetry: { attempts: 3, delaysMs: [200, 1000] },
  transientRetry: { maxAttempts: 5, baseDelaySeconds: 60, factor: 4 },
  expandChunkSize: 500,
};

export const messagingConfigDef = defineConfig(defaults, { label: "messaging" });

/** 上書きのファイルの型(`export default { ... } satisfies MessagingOverride`) */
export type MessagingOverride<E extends object = Record<never, never>> = OverrideOf<typeof messagingConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const messagingConfig: MessagingConfig = messagingConfigDef.compose(override);
