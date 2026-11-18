# Wallet ドメイン — API

## Overview

- `README.md` の API の節を分けた文書。使い方は `README.md`、決まりは札 `.claude/rules/items/features/wallet.md`

## API

### 主要な型

```typescript
import type {
  TransactionClient,       // トランザクション型
  WalletOperationOptions,  // 共通オプション { lock?: boolean, wallet?: Wallet }
  AdjustBalanceOptions,    // adjustBalance用 { lock?, wallet?, skipHistory? }
  GetWalletOptions,        // getWallet用 { lock?, createIfNotExists? }
} from "@/features/core/wallet";
```

### データモデル

#### Wallet

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | `string` | UUID |
| `user_id` | `string` | ユーザーID（FK） |
| `type` | `enum` | `regular_point` / `temporary_point` / `regular_coin` |
| `balance` | `number` | 総残高 |
| `locked_balance` | `number` | 予約済み残高 |
| `updatedAt` | `Date` | 最終更新日時 |

**ユニーク制約**: `(user_id, type)` の組み合わせ

#### WalletHistory

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | `string` | UUID |
| `user_id` | `string` | ユーザーID |
| `type` | `enum` | ウォレット種別 |
| `change_method` | `enum` | `INCREMENT` / `DECREMENT` / `SET` |
| `points_delta` | `number` | 変動量 |
| `balance_before` | `number` | 変動前残高 |
| `balance_after` | `number` | 変動後残高 |
| `source_type` | `enum` | `user_action` / `admin_action` / `system` |
| `request_batch_id` | `string?` | バッチ処理ID |
| `reason` | `string?` | 変更理由（人向けの文。集計に使わない） |
| `reason_category` | `string` | 区分（`src/features/core/walletHistory/config.ts` の `reasonCategory`、既定 `other`） |
| `reason_key` | `string?` | 付与の種類（受け口 `walletHistory/reasonKeys` の key。`Extension.md`「付与の種類（reason key）」） |
| `meta` | `jsonb` | 追加メタ情報 |
| `createdAt` | `Date` | 作成日時 |

### サービスAPI

#### walletService

```typescript
import { walletService } from "@/features/core/wallet/services/server/walletService";
```

##### getWallet

ウォレットを取得。デフォルトで存在しなければ自動作成。

```typescript
const wallet = await walletService.getWallet(
  userId: string,
  walletType: WalletTypeValue,
  tx?: TransactionClient,
  options?: {
    lock?: boolean;           // SELECT FOR UPDATE
    createIfNotExists?: boolean; // デフォルト: true
  }
);

// 存在確認のみ（自動作成しない）
const wallet = await walletService.getWallet(userId, "regular_point", tx, {
  createIfNotExists: false
});
```

##### adjustBalance

残高を調整（増減・設定）。履歴も自動記録。

```typescript
const result = await walletService.adjustBalance(
  params: {
    userId: string;
    walletType: WalletTypeValue;
    changeMethod: "INCREMENT" | "DECREMENT" | "SET";
    amount: number;
    sourceType: "user_action" | "admin_action" | "system";
    requestBatchId?: string;  // バッチ処理ID
    reason?: string;          // 変更理由
    meta?: {                  // 追加メタ情報
      productId?: string;
      orderId?: string;
      adminId?: string;
      notes?: string;
    };
  },
  tx?: TransactionClient,
  options?: {
    lock?: boolean;       // 行ロック
    skipHistory?: boolean; // 履歴記録スキップ
  }
);
// result: { wallet: Wallet, history: WalletHistory | null }
```


##### reserveBalance

残高を予約（ロック）。`locked_balance` を増加。

```typescript
const wallet = await walletService.reserveBalance(
  { userId, walletType, amount },
  tx?,
  { lock?: boolean, wallet?: Wallet }
);
```

##### releaseReservation

予約を解除。`locked_balance` を減少。

```typescript
const wallet = await walletService.releaseReservation(
  { userId, walletType, amount },
  tx?,
  { lock?: boolean }
);
```

##### consumeReservedBalance

予約済み残高を確定消費。`balance` と `locked_balance` を同時に減少。

```typescript
const result = await walletService.consumeReservedBalance(
  { userId, walletType, amount, sourceType, reason?, meta? },
  tx?,
  { lock?: boolean, wallet?: Wallet }
);
// result: { wallet: Wallet, history: WalletHistory }
```

### 型のエクスポート

#### barrel export（`@/features/core/wallet`）

```typescript
import type {
  // トランザクション
  TransactionClient,

  // オプション型
  WalletOperationOptions,   // { lock?: boolean, wallet?: Wallet }
  AdjustBalanceOptions,     // { lock?, wallet?, skipHistory? }
  GetWalletOptions,         // { lock?, createIfNotExists? }

  // パラメータ型
  AdjustWalletParams,
  ReserveWalletParams,
  ReleaseReservationParams,
  ConsumeReservationParams,

  // 結果型
  WalletAdjustmentResult,   // { wallet, history }

  // 通貨設定
  WalletType,
  CurrencyConfig,
} from "@/features/core/wallet";
```

### 履歴とメタ情報

#### request_batch_id

複数操作をグループ化するID。10連ガチャや一括処理で使用。

```typescript
const batchId = crypto.randomUUID();

for (let i = 0; i < 10; i++) {
  await walletService.consumeReservedBalance({
    ...params,
    requestBatchId: batchId,  // 全操作で同じIDを使用
  }, tx);
}
```

#### meta フィールド

JSONB形式で任意の追加情報を保存。

```typescript
await walletService.adjustBalance({
  ...params,
  meta: {
    productId: "prod-123",     // 商品ID
    orderId: "order-456",      // 注文ID
    gachaId: "gacha-789",      // ガチャID
    adminId: "admin-001",      // 管理者ID
    notes: "特別対応",          // 社内メモ
    sourceScreen: "admin/users", // 操作画面
  },
}, tx);
```

#### メタ情報のインデックス

頻繁に検索するキーにはGINインデックスを追加可能。

```sql
-- drizzle.ts または直接SQL
CREATE INDEX wallet_histories_meta_order_id_idx
ON wallet_histories USING gin ((meta ->> 'orderId'));
```

### 失効通知のデータレイヤ（独自の通知を組む）

文面やチャネルの設定で足りない場合（独自チャネル、まとめ通知など）は、組み込みの通知を設定せず、
以下の読み取り API から自前のバッチを組める。

```typescript
// 指定窓内に失効するロットを持つユーザー（userId の keyset ページング）
const { items, nextCursor } = await walletService.findUsersWithExpiringLots({
  walletType: "regular_coin",
  expiresFrom, // 窓の下限（含む）
  expiresTo,   // 窓の上限（含まない）
  cursor,      // 前ページの nextCursor
  limit: 500,
});
// items: [{ userId, totalExpiring, earliestExpiresAt }]

// スイープのユーザー単位の結果（(失効処理日時, historyId) の keyset ページング）
const { items, nextCursor } = await walletService.listExpirationResults({
  walletType: "regular_coin",
  createdFrom, // 失効処理日時の下限（含む）
  cursor,
  limit: 500,
});
// items: [{ historyId, userId, walletType, expiredAmount, balanceBefore, balanceAfter, requestBatchId, expiredAt }]
```

- **窓は絶対時刻で渡す**。`NOW()` 起点の相対日数はページをまたぐたびに窓がずれ、境界のユーザーが欠落・重複する。
  1回の実行の最初に窓を確定し、全ページで同じ値を渡すこと
- `findUsersWithExpiringLots` は1ページごとに窓内のロット数ぶんの走査コストがかかる。窓は狭く取る
- `listExpirationResults` は `createdUntil` 省略時に直近5分の行を読まない（commit 前の行を追い越して
  取りこぼすのを防ぐ安全ラグ）。`requestBatchId` 指定時はラグなし
  （`sweepExpiredWalletLots` の戻り値 `requestBatchId` でその実行分だけを読む用途）
- cursor はどちらも不透明な文字列として扱う（中身を組み立てない）
- 進捗は `cron_checkpoints`、二重送信防止は `messagingService.sendMessage` の `idempotencyKey` で足りる（ページごとの送信済みの除外は `messagingService.existingIdempotencyKeys`）。
  実装例は組み込みの通知（`services/server/notification/sendExpiredNotices.ts` / `sendPreExpiryNotices.ts`）を参照
- 予告と本通知を別々の cron に分けたい場合も、上記2つの関数をそれぞれ呼ぶルートを自前で用意すればよい
- ユーザー向け送信は `messagingService.sendMessage`（上の二重送信の鍵）。新しい cron の置き方は `src/lib/cron/README.md`「新しい定期タスクを追加する」

### 古い定数名との対応

- `CURRENCY_CONFIG` → `walletConfig.currency`
- `WALLET_EXPIRATION_CONFIG` → `.expiration`
- `WALLET_EXPIRATION_NOTICE_SETTINGS` → `.expirationNoticeSettings`
- `WALLET_LOT_PRUNE_RETENTION_DAYS` → `.lotPruneRetentionDays`
- `WALLET_PRE_EXPIRY_NOTICE_COPY` / `WALLET_EXPIRED_NOTICE_COPY` → 連絡の定義 `messages/expiringNotice.ts` / `expiredNotice.ts`
- `WALLET_ADJUSTMENT_NOTIFICATION` → 文言は `messages/adjustmentNotice.ts`、操作の表示だけ `.adjustmentNotification.changeMethodLabels`
- `APP_FEATURES.wallet.{enableAdminBalanceAdjust,purchaseRestriction,purchaseSuspension,notifyOnAdjust}` → `walletConfig.<同じ鍵>`
- `CURRENCY_ICONS` → `walletUiConfig.currencyIcons`(`config.ui.ts`)。機能の入切 `wallet.enabled` は門番の規則の持ち物で、ここには無い
