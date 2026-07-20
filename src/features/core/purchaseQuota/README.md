# purchaseQuota（購入クォータ）

1 ユーザーが特定の期間内に購入できる金額に上限を設ける汎用フレームワーク。

ベースリポジトリでは**仕組みのみ**提供する。具体的なクォータルールは下流プロジェクトで `src/config/app/purchase-quota.config.ts` を編集して宣言する。

---

## 仕組み

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

---

## ファイル構成

```
purchaseQuota/
├── README.md
├── domain.json
├── constants/index.ts                  # status enum / audit action
├── entities/
│   ├── drizzle.ts                      # purchase_quota_ledger テーブル
│   ├── schema.ts                       # Zod スキーマ
│   ├── model.ts                        # TS 型
│   ├── form.ts                         # フォーム型 (UI 未提供のため最小)
│   └── index.ts
└── services/server/wrappers/
    └── purchaseQuotaHelper.ts          # 公開 API
```

---

## 設定 (`src/config/app/purchase-quota.config.ts`)

`PURCHASE_QUOTA_RULES` 配列にルールを並べるだけで有効化される。
配列が空 (デフォルト) のときは完全に無効化され、既存挙動と完全互換。

```ts
export const PURCHASE_QUOTA_RULES: readonly QuotaRule[] = [
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

複数ルールを並列で評価し、**いずれか 1 つでも超過すれば購入が拒否される**。

### scope

| 値 | 集計対象 |
|---|---|
| `{ type: "all" }` | 全 paymentMethod の合算 |
| `{ type: "paymentMethod", value: "bank_transfer" }` | その paymentMethod のみ |

---

## 公開 API

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
- `tx` 必須 (購入レコードとの atomic 整合のため)

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
- 状態変更なし
- 各ルールの現在使用量と残り上限を返す

### cleanupOldLedger
```ts
cleanupOldLedger(retentionDays = 90): Promise<number>
```
- 古い ledger 行を物理削除 (cron 用)

---

## 統合ポイント (ベース提供分)

| 場所 | 呼ばれる API |
|---|---|
| `initiatePurchase` (新規 / pending 再利用 両方) | `reserveQuota` |
| `completePurchase` | `commitQuota` |
| `failPurchase` (onFail あり/なし両方) | `releaseQuota` |
| `cancelPurchase` (ユーザーキャンセル) | `releaseQuota` |
| `expirePendingRequests` (bulk + per-row 両方) | `releaseQuota` |

`bankTransferReview` の `submitReview` / `confirmReview` / `rejectReview` は内部で `completePurchase` / `failPurchase` を呼ぶため自動で連動する。

---

## クォータ超過時のクライアント挙動

- HTTP ステータス: `429`
- レスポンス例: `{ "message": "購入上限を超えました (銀行振込: 1時間30万円)。しばらく経ってから再度お試しください。" }`
- ClientService の `normalizeHttpError` 経由で UI に伝搬

---

## cron

```bash
pnpm task purchase-quota-cleanup
```
- 推奨スケジュール: `0 4 * * *` (audit-log-prune と同様の時間帯)
- 90 日より古い ledger 行を物理削除

---

## DB マイグレーション

新規テーブル `purchase_quota_ledger` を追加する。

```bash
pnpm drizzle-kit push
```

既存テーブルへの変更は無いため、稼働中プロジェクトもダウンタイム無しで導入可能。

---

## 設計上の注意点

- **冪等性**: 同一 `purchase_request_id` への reserveQuota 再呼び出しは既存 active 行を上書き
- **整合性**: reserveQuota は呼び出し側の購入 tx に必ず相乗りする (rollback で台帳も巻き戻る)
- **監査ログ**: クォータ超過拒否のみ記録 (reserve/commit/release は高頻度のため不記録)。`purchase_quota.reservation.exceeded` action は `auditLogger.record` で `bestEffort: true` を指定し、AuditContext 未設定時も dead-letter 経由で残る
- **並行制御**: 同一ユーザーの並行 reserve は `pg_advisory_xact_lock(hashtext(userId))` で直列化
- **rate limit との違い**: rateLimit は「リクエスト回数」、purchaseQuota は「累積金額」を制御する。両方とも independent に動作する
