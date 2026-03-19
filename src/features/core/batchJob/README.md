# BatchJob ドメイン

大量データを安全にチャンク分割処理するための汎用バッチジョブ基盤。
進捗追跡、冪等性、クラッシュリカバリを標準提供する。

---

## クイックスタート

### ダウンストリームの利用例（ウォレット一括調整）

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

### 概要

| 項目 | 内容 |
|------|------|
| **テーブル** | `batch_jobs`（ジョブ管理）、`batch_job_items`（アイテム単位の進捗） |
| **実行モード** | processChunk（DB操作向け）、processItem（外部API向け） |
| **同時実行制御** | FOR UPDATE SKIP LOCKED（ジョブ行 / アイテム行） |
| **冪等性** | UNIQUE(job_type, job_key) + UNIQUE(job_id, item_key) |
| **ステータス** | pending → running → completed / failed / cancelled |

---

## 2つの実行モード

### processChunk — DB操作中心

- チャンク全体が **1トランザクション**
- クラッシュ時はロールバックでpendingに戻る（リカバリ不要）
- `ChunkResult` で succeeded / failed / skipped を返す

### processItem — 外部API・長時間処理

- **アイテムごと** に独立したトランザクション
- アイテム単位で pending → processing → completed / failed
- クラッシュ時: processing のまま残るが `recoverStaleItems` で回復可能

---

## 新しいバッチジョブの追加方法

### 1. ハンドラを定義

```typescript
// src/features/core/<domain>/services/server/handlers/myBatchHandler.ts
import { registerBatchJobHandler } from "@/features/batchJob/services/server/registry";
import type { BatchJobHandler } from "@/features/batchJob/types";

type MyParams = {
  templateId: string;
  subject: string;
};

const handler: BatchJobHandler<MyParams> = {
  // processChunk か processItem のどちらか一方を定義（排他）
  processItem: async (itemKey, params, tx) => {
    await mailService.send(itemKey, params.templateId, params.subject);
  },
  recoveryTimeoutMs: 60_000, // processItem専用（省略時: 5分）
};

export const MY_BATCH_JOB_TYPE = "my_batch_job";
registerBatchJobHandler(MY_BATCH_JOB_TYPE, handler);
```

### 2. ファサード関数を提供（推奨）

ダウンストリームが jobType や params 構造を知らずに使えるようにする。

```typescript
// 同じファイルに追記
import { batchJobService } from "@/features/batchJob/services/server/batchJobService";
import type { BatchJob } from "@/features/batchJob/types";

export async function createMyBatchJob(input: {
  jobKey: string;
  userIds: string[];
  templateId: string;
  subject: string;
}): Promise<BatchJob> {
  return batchJobService.createJob({
    jobType: MY_BATCH_JOB_TYPE,
    jobKey: input.jobKey,
    itemKeys: input.userIds,
    params: { templateId: input.templateId, subject: input.subject } satisfies MyParams,
  });
}
```

### 3. ハンドラ登録を保証

`registerHandlers.ts` にimportを追加:

```typescript
// src/features/core/batchJob/services/server/registerHandlers.ts
import "@/features/wallet/services/server/handlers/walletBulkAdjustHandler";
import "@/features/<domain>/services/server/handlers/myBatchHandler"; // 追加
```

---

## データモデル

### batch_jobs

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | uuid PK | |
| `job_type` | text | ハンドラ識別キー |
| `job_key` | text | 冪等キー |
| `status` | enum | pending / running / completed / failed / cancelled |
| `total_count` | integer | 総アイテム数 |
| `processed_count` | integer | 処理済み数 |
| `failed_count` | integer | 失敗数 |
| `skipped_count` | integer | スキップ数 |
| `batch_size` | integer | 1チャンクの処理件数（デフォルト: 100） |
| `max_retry_count` | integer | 最大リトライ回数（デフォルト: 2） |
| `params` | jsonb | ジョブ固有パラメータ |
| `target_query` | jsonb | 対象抽出条件の記録用（メタデータ） |
| `error_summary` | text | チャンクレベル例外時のエラー |
| `started_at` | timestamp | 実行開始日時 |
| `completed_at` | timestamp | 完了日時 |

**ユニーク制約**: `(job_type, job_key)`

### batch_job_items

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | uuid PK | |
| `job_id` | uuid FK | → batch_jobs (CASCADE) |
| `item_key` | text | 対象識別子（userId等） |
| `status` | enum | pending / processing / completed / failed / skipped |
| `retry_count` | integer | リトライ回数 |
| `error_message` | text | エラーメッセージ |
| `processed_at` | timestamp | 処理日時 |

**ユニーク制約**: `(job_id, item_key)` — 構造的冪等性
**インデックス**: `(job_id, status)` — 未処理アイテム取得用

---

## サービスAPI

```typescript
import { batchJobService } from "@/features/batchJob/services/server";
```

| メソッド | 説明 |
|----------|------|
| `createJob(input)` | ジョブ + アイテムを1トランザクションで作成 |
| `executeChunk(jobId)` | 1チャンク分を処理。`{ hasMore, job }` を返す |
| `executeAll(jobId, maxDurationMs?)` | maxDurationMsまでループ実行（デフォルト: 55秒） |
| `cancel(jobId)` | ジョブをキャンセル。処理済み分は巻き戻さない |
| `getProgress(jobId)` | 進捗情報を取得 |
| `recoverStaleItems(jobId)` | processItemモードの滞留アイテムを回復 |

---

## 管理API

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/admin/batch-jobs` | ジョブ作成 |
| GET | `/api/admin/batch-jobs/[jobId]` | 進捗取得 |
| POST | `/api/admin/batch-jobs/[jobId]/execute` | 実行（executeAll） |
| PATCH | `/api/admin/batch-jobs/[jobId]/cancel` | キャンセル |

---

## 設定

```typescript
// src/features/core/batchJob/constants/index.ts
export const BATCH_JOB_CONFIG = {
  defaultMaxDurationMs: 55_000,      // executeAllの最大実行時間
  defaultBatchSize: 100,             // 1チャンクの件数
  defaultRecoveryTimeoutMs: 300_000, // processing→pending回復タイムアウト
  defaultMaxRetryCount: 2,           // 最大リトライ回数
  itemsInsertChunkSize: 5_000,       // アイテム一括INSERT単位
};
```

---

## ステータス遷移

### batch_jobs

```
pending → running     （最初のexecuteChunk時）
running → completed   （pending + processing 残0件）
running → failed      （チャンクレベル例外）
running → cancelled   （管理者キャンセル）
```

### batch_job_items（processChunkモード）

```
pending → completed | failed | skipped
※ processing は出現しない
```

### batch_job_items（processItemモード）

```
pending → processing → completed | failed
processing → pending  （リカバリ: recoverStaleItems）
```

---

## ディレクトリ構造

```
src/features/core/batchJob/
├── README.md
├── types/
│   └── index.ts                 # BatchJob, BatchJobHandler, ChunkResult 等
├── constants/
│   └── index.ts                 # BATCH_JOB_CONFIG
├── entities/
│   └── drizzle.ts               # batch_jobs, batch_job_items テーブル定義
└── services/
    └── server/
        ├── index.ts             # 公開エントリポイント（ハンドラ登録を保証）
        ├── batchJobService.ts   # コアロジック
        ├── registry.ts          # ハンドラレジストリ
        ├── helpers.ts           # createJobFromQuery
        └── registerHandlers.ts  # ハンドラimport集約
```

### 関連ファイル（ウォレットハンドラ）

```
src/features/core/wallet/services/server/
├── handlers/
│   └── walletBulkAdjustHandler.ts  # ハンドラ定義 + ファサード関数
└── wrappers/
    └── bulkAdjustByUsers.ts        # バルク調整ロジック
```

---

## Phase 2（未実装）

- 管理画面UI（進捗表示、実行/キャンセルボタン、ポーリング）
- registerHandlers.ts の自動検出
- processItemモードのジョブレベル同時実行制御強化
- データ保持期間・クリーンアップ
