// src/registry/cronTaskRegistry.ts
// 定期タスクの一覧（唯一の正）。dispatcher・個別 API ルート・CLI（pnpm task）がすべてここを読む。
//
// - 新しい定期タスク = ここに 1 エントリ + 個別ルート src/app/api/cron/<name>/route.ts（1 行）。
//   vercel.json は触らない（dispatcher が cadence に従って起動する）
// - fork 独自のタスクは src/registry/forkCronTaskRegistry.ts（fork 所有）に書く。このファイルは upstream 所有
// - ワンショット（バックフィル・データ移行）は定期実行してはいけないので、ここではなく scripts/tasks/run.ts に書く
// - run は動的 import にする（レジストリを読むだけで全タスクの依存を読み込まないため）
// - enabled は config だけを見る（DB に触れない）。個人情報の retention prune は機能を後から無効にしても
//   既存行を消し続ける必要があるため、enabled を付けず常に起動する
//
// 対応表（pnpm test:cron-wiring が検査）: エントリ ⇔ src/app/api/cron/<name>/route.ts
// 詳細: src/lib/cron/README.md

import type { CronTaskDefinition } from "@/lib/cron/types";
import {
  getExpirationEnabledWalletTypes,
  getSweepEnabledWalletTypes,
  hasAnyExpirationNoticeConfig,
} from "@/features/core/wallet/utils/expiration";
import { FORK_CRON_TASKS } from "./forkCronTaskRegistry";

export const CORE_CRON_TASKS: CronTaskDefinition[] = [
  {
    name: "expire-pending-purchases",
    description: "期限切れの pending 購入リクエストを expired に遷移する（onExpire フックの副次テーブル掃除を含む）",
    cadence: "15m",
    run: async () => {
      const { expirePendingRequests } = await import(
        "@/features/core/purchaseRequest/services/server/wrappers/purchaseService"
      );
      const expired = await expirePendingRequests();
      return { expired };
    },
  },
  {
    name: "audit-log-prune",
    description: "retention_days を過ぎた監査ログ（audit_logs）をバッチ削除する",
    cadence: "daily",
    run: async () => {
      const { pruneExpiredAuditLogs } = await import("@/features/core/auditLog/services/server");
      return await pruneExpiredAuditLogs();
    },
  },
  {
    name: "audit-log-recover-dead-letter",
    description: "監査ログの dead-letter（audit_logs_failed）を audit_logs へ再投入する",
    cadence: "hourly",
    run: async () => {
      const { recoverDeadLetterAuditLogs } = await import("@/features/core/auditLog/services/server");
      return await recoverDeadLetterAuditLogs();
    },
  },
  {
    name: "analytics-rollup-daily",
    description: "登録済みメトリクスの日次ロールアップを直近数日ぶん冪等に再計算する",
    cadence: "daily",
    run: async () => {
      const { runDailyRollup } = await import("@/features/core/analytics/services/server/rollup");
      return await runDailyRollup();
    },
  },
  {
    name: "interaction-event-prune",
    description: "保持期限を過ぎた interactionTracking のイベント明細を削除する（累計・日次集計は残る）",
    cadence: "daily",
    run: async () => {
      const { pruneExpiredInteractionEvents } = await import("@/features/core/interactionTracking/services/server");
      return await pruneExpiredInteractionEvents();
    },
  },
  {
    name: "user-daily-counter-prune",
    description: "保持期限を過ぎた userCounter の日次行を削除する（累計は残る）",
    cadence: "daily",
    run: async () => {
      const { pruneExpiredUserDailyCounters } = await import("@/features/core/userCounter/services/server/pruning");
      return await pruneExpiredUserDailyCounters();
    },
  },
  {
    name: "user-login-event-prune",
    description: "retention_days を過ぎたログインイベント（user_login_events、IP を含む）を削除する",
    cadence: "daily",
    run: async () => {
      const { pruneExpiredUserLoginEvents } = await import("@/features/core/userLoginEvent/services/server");
      return await pruneExpiredUserLoginEvents();
    },
  },
  {
    name: "device-fingerprint-prune",
    description: "retention_days を過ぎたデバイスフィンガープリント（device_fingerprints）を削除する",
    cadence: "daily",
    run: async () => {
      const { pruneExpiredDeviceFingerprints } = await import("@/features/core/deviceFingerprint/services/server");
      return await pruneExpiredDeviceFingerprints();
    },
  },
  {
    name: "fingerprint-challenge-access-prune",
    description: "retention_days を過ぎたチャレンジ閲覧イベント（IP + UA）を削除する",
    cadence: "daily",
    run: async () => {
      const { pruneExpiredChallengeAccessEvents } = await import(
        "@/features/core/fingerprintChallenge/services/server"
      );
      return await pruneExpiredChallengeAccessEvents();
    },
  },
  {
    name: "wallet-expire-lots",
    description: "有効期限切れウォレットロットの残額を没収する（sweepEnabled の通貨のみ）",
    cadence: "daily",
    enabled: () => getSweepEnabledWalletTypes().length > 0,
    run: async () => {
      const { sweepExpiredWalletLots } = await import(
        "@/features/core/wallet/services/server/lots/sweepExpiredLots"
      );
      return await sweepExpiredWalletLots();
    },
  },
  {
    name: "wallet-lots-prune",
    description: "消費し尽くしたウォレットロット（remaining = 0）を保持期間経過後に削除する",
    cadence: "daily",
    enabled: () => getExpirationEnabledWalletTypes().length > 0,
    run: async () => {
      const { pruneConsumedWalletLots } = await import(
        "@/features/core/wallet/services/server/lots/pruneConsumedLots"
      );
      return await pruneConsumedWalletLots();
    },
  },
  {
    name: "wallet-expiration-notice",
    description: "ウォレットの失効予告・失効時の本通知をメール / サービス内通知で送る",
    cadence: "hourly",
    enabled: hasAnyExpirationNoticeConfig,
    run: async () => {
      const { sendWalletExpirationNotices } = await import(
        "@/features/core/wallet/services/server/notification/sendWalletExpirationNotices"
      );
      return await sendWalletExpirationNotices();
    },
  },
];

/** dispatcher・CLI が扱う全タスク（upstream + fork） */
export const CRON_TASKS: CronTaskDefinition[] = [...CORE_CRON_TASKS, ...FORK_CRON_TASKS];

/**
 * 名前でタスク定義を引く。未登録なら throw（個別ルートのモジュール読み込み時に気付けるように）
 */
export function getCronTask(name: string): CronTaskDefinition {
  const task = CRON_TASKS.find((candidate) => candidate.name === name);
  if (!task) {
    throw new Error(
      `cron タスク "${name}" は未登録です（src/registry/cronTaskRegistry.ts か forkCronTaskRegistry.ts に追加してください）`,
    );
  }
  return task;
}
