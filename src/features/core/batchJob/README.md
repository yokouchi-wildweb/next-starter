# BatchJob ドメイン

## Overview

- 大量データを安全にチャンク分割処理するための汎用バッチジョブ基盤。進捗追跡、冪等性、クラッシュリカバリを標準提供する
- テーブル: `batch_jobs`（ジョブ管理）、`batch_job_items`（アイテム単位の進捗）
- 実行モード: processChunk（DB 操作向け）、processItem（外部 API 向け）
- 同時実行制御: FOR UPDATE SKIP LOCKED（ジョブ行 / アイテム行）
- 冪等性: UNIQUE(job_type, job_key) + UNIQUE(job_id, item_key)
- ステータス: pending → running → completed / failed / cancelled
- 入口: `@/features/batchJob/services/server`（`batchJobService`・`getHandler`・`createJobFromQuery`）。型は `@/features/core/batchJob/types`
- 決まり（入口・ハンドラの書き方・ファサード）は札 `.claude/rules/items/features/batchJob.md`

## Usage

ダウンストリームの利用例（ウォレット一括調整）:

```typescript
import { createWalletBulkAdjustJob } from "@/features/wallet/services/server/handlers/walletBulkAdjustHandler";
import { batchJobService } from "@/features/batchJob/services/server";

// 1. ジョブ作成（型安全、内部構造を知る必要なし）
const job = await createWalletBulkAdjustJob({
  jobKey: raidConfigId,
  userIds: participantUserIds,
  walletType: "coin",
  changeMethod: "INCREMENT",
  amount: rewardAmount,
  reason: "レイド参加報酬",
  reasonCategory: "raid_reward",
});

// 2. 実行（maxDurationMs まで自動ループ、hasMore=true なら再呼出）
const result = await batchJobService.executeAll(job.id);

// 3. 進捗確認
const progress = await batchJobService.getProgress(job.id);
```

## API

サービス（`batchJobService`）:

- `createJob(input)`: ジョブ + アイテムを 1 トランザクションで作成
- `executeChunk(jobId)`: 1 チャンク分を処理。`{ hasMore, job }` を返す
- `executeAll(jobId, maxDurationMs?)`: maxDurationMs までループ実行（既定 55 秒）
- `cancel(jobId)`: ジョブをキャンセル。処理済み分は巻き戻さない
- `getProgress(jobId)`: 進捗情報を取得
- `recoverStaleItems(jobId)`: processItem モードの滞留アイテムを回復

管理 API:

- POST `/api/admin/batch-jobs`: ジョブ作成
- GET `/api/admin/batch-jobs/[jobId]`: 進捗取得
- POST `/api/admin/batch-jobs/[jobId]/execute`: 実行（executeAll）
- PATCH `/api/admin/batch-jobs/[jobId]/cancel`: キャンセル

`batch_jobs`:

- `id` uuid PK
- `job_type` text: ハンドラ識別キー
- `job_key` text: 冪等キー
- `status` enum: pending / running / completed / failed / cancelled
- `total_count` / `processed_count` / `failed_count` / `skipped_count` integer: 総数・処理済み・失敗・スキップの数
- `batch_size` integer: 1 チャンクの処理件数
- `max_retry_count` integer: 最大リトライ回数(今は記録だけ。failed のアイテムを自動で再実行する処理は無い)
- `params` jsonb: ジョブ固有パラメータ
- `target_query` jsonb: 対象抽出条件の記録用（メタデータ）
- `error_summary` text: チャンクレベル例外時のエラー
- `started_at` / `completed_at` timestamp: 実行開始・完了日時
- ユニーク制約: `(job_type, job_key)`

`batch_job_items`:

- `id` uuid PK
- `job_id` uuid FK → batch_jobs (CASCADE)
- `item_key` text: 対象識別子（userId 等）
- `status` enum: pending / processing / completed / failed / skipped
- `retry_count` integer: リトライ回数
- `error_message` text: エラーメッセージ
- `processed_at` timestamp: 処理日時
- ユニーク制約: `(job_id, item_key)`（構造的冪等性）
- インデックス: `(job_id, status)`（未処理アイテム取得用）

既定値は `constants/index.ts` の `BATCH_JOB_CONFIG`（executeAll の最大実行時間・1 チャンクの件数・processing → pending の回復タイムアウト・最大リトライ回数・アイテム一括 INSERT の単位）。

## Extension

新しいバッチジョブの追加:

1. ハンドラを `src/features/core/batchJob/jobHandlers/<名前>.ts` に置き、`pnpm generate extensions` で一覧に入れる（受け口 `jobHandlers`、`extensionPoints.ts`）

```typescript
import { defineBatchJobHandler } from "@/features/core/batchJob/types";

type MyParams = {
  orderNo: string;
};

export const jobHandler = defineBatchJobHandler<MyParams>({
  jobType: MY_BATCH_JOB_TYPE, // ファサードと共有する定数は別のファイル
  // processChunk か processItem のどちらか一方
  processItem: async (itemKey, params, tx) => {
    // 利用者への連絡は messagingService.sendMessage(連絡の定義 messages/<名前>.ts)
    await messagingService.sendMessage(orderShipped, { recipient: { userId: itemKey }, vars: { orderNo: params.orderNo } });
  },
  recoveryTimeoutMs: 60_000, // processItem 専用（省略時: 5 分）
});
```

2. ファサード関数を提供する（ダウンストリームが jobType や params 構造を知らずに使える）

```typescript
// src/features/<domain>/services/server/handlers/myBatchJob.ts
import { batchJobService } from "@/features/batchJob/services/server/batchJobService";
import type { BatchJob } from "@/features/batchJob/types";

export async function createMyBatchJob(input: {
  jobKey: string;
  userIds: string[];
  orderNo: string;
}): Promise<BatchJob> {
  return batchJobService.createJob({
    jobType: MY_BATCH_JOB_TYPE,
    jobKey: input.jobKey,
    itemKeys: input.userIds,
    params: { orderNo: input.orderNo } satisfies MyParams,
  });
}
```

## Internals

processChunk（DB 操作中心）:

- チャンク全体が 1 トランザクション
- クラッシュ時はロールバックで pending に戻る（リカバリ不要）
- `ChunkResult` で succeeded / failed / skipped を返す

processItem（外部 API・長時間処理）:

- アイテムごとに独立したトランザクション
- アイテム単位で pending → processing → completed / failed
- クラッシュ時は processing のまま残るが `recoverStaleItems` で回復できる

ステータス遷移（`batch_jobs`）:

```
pending → running     （最初のexecuteChunk時）
running → completed   （pending + processing 残0件）
running → failed      （チャンクレベル例外）
pending / running → cancelled（管理者キャンセル。処理済み分は巻き戻さない）
```

ステータス遷移（`batch_job_items`）:

```
processChunk: pending → completed | failed | skipped（processing は出現しない）
processItem:  pending → processing → completed | failed
              processing → pending（リカバリ: recoverStaleItems）
```

- ハンドラの読み手は `services/server/registry.ts`（一覧 `extensions/jobHandlers`）。`services/server/index.ts` が登録を保証して公開する
- `createJobFromQuery` は `services/server/helpers.ts`

## Related

- ウォレット一括調整: ファサード `src/features/core/wallet/services/server/handlers/walletBulkAdjustHandler.ts`、処理の本体 `jobHandlers/walletBulkAdjust.ts`、バルク調整ロジック `src/features/core/wallet/services/server/wrappers/bulkAdjustByUsers.ts`
