// src/domains/core/outbox/config.ts
// 送り箱(outbox)の処理の値(既定 + 上書き)。上書きは src/config/domains/outbox.config.ts(このファイルだけが読む、型 4)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。入切のスイッチではない(開閉は機能 outbox、src/featureGate/rules/outbox.ts)。

import override from "@/config/domains/outbox.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type OutboxConfig = {
  /**
   * 再試行の既定(処理の項目が maxAttempts / backoff を書かない時)
   * - maxAttempts: 初回を含む試行の上限。達したら隔離する(消さない)
   * - backoff: 次の試行まで baseSeconds × 2^(試行 − 1) 秒、maxSeconds で頭打ち
   */
  retry: { maxAttempts: number; backoff: { baseSeconds: number; maxSeconds: number } };
  /**
   * 定期処理(cron outbox-dispatch)
   * - budgetMs: 1 回の実行の予算(maxDuration 300 秒 − 1 束 − 余裕)
   * - batchSize: 1 束で取る行の数
   */
  dispatch: { budgetMs: number; batchSize: number };
  /**
   * 監視のしきい値(定期処理の最後に kind ごとに比べ、超えた kind を失敗の記録へ 1 行)。0 = 見ない
   * - pending: 待ち(pending と running)の行の数
   * - oldestWaitSeconds: 一番古い待ちの行の積んでからの秒
   * - quarantined: 隔離した行の数(この数以上で記録)
   * - noHandler: 処理の項目の無い kind の行を記録するか
   */
  thresholds: { pending: number; oldestWaitSeconds: number; quarantined: number; noHandler: boolean };
};

const defaults: OutboxConfig = {
  retry: { maxAttempts: 8, backoff: { baseSeconds: 30, maxSeconds: 3600 } },
  dispatch: { budgetMs: 240_000, batchSize: 50 },
  thresholds: { pending: 1000, oldestWaitSeconds: 3600, quarantined: 1, noHandler: true },
};

export const outboxConfigDef = defineConfig(defaults, { label: "outbox" });

/** 上書きのファイルの型(`export default { ... } satisfies OutboxOverride`) */
export type OutboxOverride<E extends object = Record<never, never>> = OverrideOf<typeof outboxConfigDef, E>;

export const outboxConfig: OutboxConfig = outboxConfigDef.compose(override);
