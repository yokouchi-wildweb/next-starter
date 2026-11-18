# purchaseQuota（購入クォータ）

## Overview

- 1 ユーザーが特定の期間内に購入できる金額に上限を設ける汎用フレームワーク
- ベースリポジトリでは仕組みのみ提供する。具体的なクォータルールは下流プロジェクトが設定で宣言する(Extension)
- 使う時・直す時の決まりは札 .claude/rules/items/features/purchaseQuota.md にある。この README は使い方と仕組み

## Usage

古い ledger 行の掃除:

```bash
pnpm task purchaseQuota:cleanup
```

- 推奨: 1 日 1 回（深夜帯）
- 90 日より古い ledger 行を物理削除
- CLI 専用タスク（`/api/cron/*` には無い = 定期実行されない）。定期実行の足し方は [cron 基盤 README](../../../lib/cron/README.md#新しい定期タスクを追加する)

導入時は新規テーブル `purchase_quota_ledger` を `pnpm db:push` で作る。既存テーブルへの変更は無いため、稼働中プロジェクトもダウンタイム無しで導入できる。

## API

```ts
import {
  reserveQuota,
  commitQuota,
  releaseQuota,
  getQuotaUsage,
  cleanupOldLedger,
  PurchaseQuotaExceededError,
} from "@/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper";
```

### reserveQuota

```ts
reserveQuota({ userId, paymentMethod, amount, purchaseRequestId }, tx): Promise<void>
```

- ルール超過時 `PurchaseQuotaExceededError` (status 429) を throw
- 同一 `purchaseRequestId` で再呼び出しすると既存行を上書き (pending 再利用に対応)
- 同一ユーザー単位で `pg_advisory_xact_lock` により直列化
- 監査ログに `purchase_quota.reservation.exceeded` を tx 外で記録 (rollback でも残る)
- `tx` 必須

### commitQuota

```ts
commitQuota(purchaseRequestId, tx?): Promise<void>
```

- status reserved → committed (集計値不変)

### releaseQuota

```ts
releaseQuota(purchaseRequestId: string | readonly string[], tx?): Promise<void>
```

- status reserved/committed → released (集計除外)
- 複数 ID をまとめて release 可能 (bulk expire 用)

### getQuotaUsage

```ts
getQuotaUsage(userId): Promise<QuotaUsage[]>
```

- 状態変更なし。各ルールの現在使用量と残り上限を返す

### cleanupOldLedger

```ts
cleanupOldLedger(retentionDays = 90): Promise<number>
```

- 古い ledger 行を物理削除 (cron 用)

### クォータ超過時のクライアント挙動

- HTTP ステータス: `429`
- レスポンス例: `{ "message": "購入上限を超えました (銀行振込: 1時間30万円)。しばらく経ってから再度お試しください。" }`
- ClientService の `normalizeHttpError` 経由で UI に伝搬

## Extension

設定は `config.ts`、上書きは `src/config/features/purchaseQuota.config.ts`。`rules` 配列にルールを並べるだけで有効化される。配列が空 (既定) のときは完全に無効。

```ts
export const rules: readonly QuotaRule[] = [
  {
    key: "bank_transfer_hourly",
    label: "銀行振込: 1時間30万円",
    scope: { type: "paymentMethod", value: "bank_transfer" },
    windowSeconds: 3600,
    maxAmount: 300_000,
  },
  {
    key: "all_daily",
    label: "全決済: 1日100万円",
    scope: { type: "all" },
    windowSeconds: 86400,
    maxAmount: 1_000_000,
  },
];
```

複数ルールを並列で評価し、いずれか 1 つでも超過すれば購入が拒否される。

scope:

| 値 | 集計対象 |
|---|---|
| `{ type: "all" }` | 全 paymentMethod の合算 |
| `{ type: "paymentMethod", value: "bank_transfer" }` | その paymentMethod のみ |

## Internals

### 流れ

```
initiatePurchase
  ↓
reserveQuota: ルールごとに使用量を集計 → 上限超過なら PurchaseQuotaExceededError (429)
  ↓ pass
ledger に reserved 行を insert (または上書き)
  ↓
completePurchase → commitQuota (reserved → committed、集計値は不変)
failPurchase / cancelPurchase / expirePending → releaseQuota (集計から除外)
```

ledger の status:

| status | 集計対象 | 用途 |
|---|---|---|
| reserved | ✓ | 仮押さえ (pending/processing) |
| committed | ✓ | 完了済み |
| released | × | 失敗・キャンセル・期限切れ |

### 統合ポイント (ベース提供分)

| 場所 | 呼ばれる API |
|---|---|
| `initiatePurchase` (新規 / pending 再利用 両方) | `reserveQuota` |
| `completePurchase` | `commitQuota` |
| `failPurchase` (onFail あり/なし両方) | `releaseQuota` |
| `cancelPurchase` (ユーザーキャンセル) | `releaseQuota` |
| `expirePendingRequests` (bulk + per-row 両方) | `releaseQuota` |

`bankTransferReview` の `submitReview` / `confirmReview` / `rejectReview` は内部で `completePurchase` / `failPurchase` を呼ぶため自動で連動する。

### 監査ログ

- `purchase_quota.reservation.exceeded` は `auditLogger.record` で `bestEffort: true` を指定し、AuditContext 未設定時も dead-letter 経由で残る

### rateLimit との違い

| | rateLimit (`src/features/core/rateLimit`) | purchaseQuota (本機能) |
|---|---|---|
| 制御対象 | リクエスト**回数** | 累積**金額** |
| 識別子 | 呼び出し側が渡す識別子（routeFactory の `rateLimit` / `rateLimitSubnet` は IP / サブネット） | userId |
| 上限の種類 | `maxRequests` | `maxAmount` (円) |
| 適用箇所 | routeFactory の `rateLimit` / `rateLimitSubnet` オプション等 | `initiatePurchase` 内 (固定組込) |
| ロールバック | 不要 | 失敗・キャンセル・期限切れ時に release |

2 つは独立して動作し、両方同時に有効化できる。
