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
  /**
   * 上流の経路の項目の入切(経路の項目の enabled が読む。門の機能ではない)
   * - line: LINE push(既定 切。開ける時は LINE の Messaging API の env と userLineProfile の機能も要る)
   */
  channels: { line: { enabled: boolean } };
  /** 全員・ロール・audiences の展開の 1 束の人数(cron が使う) */
  expandChunkSize: number;
  /**
   * 送信の掃き出し(cron messaging-send-sweep)
   * - budgetMs: 1 回の実行の予算(maxDuration 300 秒 − 1 束 − 余裕)
   * - deliveryChunkSize: 1 束で取る配達の行の数
   * - expandChunksPerRun: 1 回の実行で進める展開の束の上限(送信の時間を残す)
   * - leaseSeconds: 取った行を他の処理が取らない時間(過ぎて sending のままの行は unknown)
   */
  sweep: { budgetMs: number; deliveryChunkSize: number; expandChunksPerRun: number; leaseSeconds: number };
  /**
   * 保持(cron messaging-retention)。日数を過ぎた行を消す
   * - dispatchesDays: お知らせ(message_inbox_items)が参照する回は残す。消す時に冪等の鍵を message_idempotency_keys へ移す
   * - idempotencyKeyDays: 移した鍵の期限(null = 無期限)
   * - chunkSize: 1 文で消す行の数
   */
  retention: {
    eventsDays: number;
    deliveriesDays: number;
    dispatchesDays: number;
    idempotencyKeyDays: number | null;
    chunkSize: number;
    budgetMs: number;
  };
};

const defaults: MessagingConfig = {
  smallSendMaxRecipients: 100,
  inRequestBatchSize: 50,
  requiredRetry: { attempts: 3, delaysMs: [200, 1000] },
  transientRetry: { maxAttempts: 5, baseDelaySeconds: 60, factor: 4 },
  expandChunkSize: 500,
  channels: { line: { enabled: false } },
  sweep: { budgetMs: 240_000, deliveryChunkSize: 100, expandChunksPerRun: 20, leaseSeconds: 300 },
  retention: {
    eventsDays: 30,
    deliveriesDays: 90,
    dispatchesDays: 730,
    idempotencyKeyDays: null,
    chunkSize: 1000,
    budgetMs: 240_000,
  },
};

export const messagingConfigDef = defineConfig(defaults, { label: "messaging" });

/** 上書きのファイルの型(`export default { ... } satisfies MessagingOverride`) */
export type MessagingOverride<E extends object = Record<never, never>> = OverrideOf<typeof messagingConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const messagingConfig: MessagingConfig = messagingConfigDef.compose(override);
