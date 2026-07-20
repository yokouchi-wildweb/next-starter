# Wallet ドメイン

複数種類のアプリ内通貨（ポイント、コイン等）を統一的に管理するウォレット機能。

---

## クイックスタート（5分で把握）

### 概要

| 項目 | 内容 |
|------|------|
| **テーブル** | `wallets`（残高）、`wallet_histories`（履歴） |
| **通貨種別** | `regular_point`、`temporary_point`、`regular_coin` |
| **残高管理** | `balance`（総残高）- `locked_balance`（予約済み）= 利用可能残高 |
| **ウォレット作成** | 遅延作成（初回操作時に自動作成） |
| **設定ファイル** | `src/config/app/currency.config.ts`（通貨の追加・変更はここで行う） |

### 基本操作

```typescript
import { walletService } from "@/features/core/wallet/services/server/walletService";

// 残高を増やす
await walletService.adjustBalance({
  userId: "user-123",
  walletType: "regular_point",
  changeMethod: "INCREMENT",
  amount: 1000,
  sourceType: "admin_action",
  reason: "キャンペーン付与",
});

// 残高を減らす
await walletService.adjustBalance({
  userId: "user-123",
  walletType: "regular_point",
  changeMethod: "DECREMENT",
  amount: 500,
  sourceType: "user_action",
});

// ウォレット取得（存在しなければ自動作成）
const wallet = await walletService.getWallet(userId, "regular_point");
```

### 予約→確定フロー（ガチャ・購入等）

```typescript
import { db } from "@/lib/drizzle";

await db.transaction(async (tx) => {
  // 1. 残高を予約（ロック）
  await walletService.reserveBalance(
    { userId, walletType: "regular_point", amount: 100 },
    tx,
    { lock: true }
  );

  // 2. 処理実行（ガチャ抽選など）
  const result = await executeGacha();

  // 3. 予約を確定消費
  await walletService.consumeReservedBalance(
    { userId, walletType: "regular_point", amount: 100, sourceType: "user_action" },
    tx
  );
});
```

### 主要な型

```typescript
import type {
  TransactionClient,       // トランザクション型
  WalletOperationOptions,  // 共通オプション { lock?: boolean }
  AdjustBalanceOptions,    // adjustBalance用 { lock?, skipHistory? }
  GetWalletOptions,        // getWallet用 { lock?, createIfNotExists? }
} from "@/features/core/wallet";
```

---

## データモデル

### Wallet

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | `string` | UUID |
| `user_id` | `string` | ユーザーID（FK） |
| `type` | `enum` | `regular_point` / `temporary_point` / `regular_coin` |
| `balance` | `number` | 総残高 |
| `locked_balance` | `number` | 予約済み残高 |
| `updatedAt` | `Date` | 最終更新日時 |

**ユニーク制約**: `(user_id, type)` の組み合わせ

### WalletHistory

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
| `reason` | `string?` | 変更理由 |
| `meta` | `jsonb` | 追加メタ情報 |
| `createdAt` | `Date` | 作成日時 |

---

## サービスAPI

### walletService

```typescript
import { walletService } from "@/features/core/wallet/services/server/walletService";
```

#### getWallet

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

#### adjustBalance

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

##### 管理者操作時のユーザー通知

管理画面からの残高変更（`POST /api/admin/wallet/[userId]/adjust`）時に、ユーザーへ通知を送信できる。操作タイプ別にフィーチャーフラグで制御:

```typescript
// app-features.config.ts
wallet: {
  notifyOnAdjust: {
    increment: false,  // 増加時に通知
    decrement: false,  // 減少時に通知
    set: false,        // 残高設定時に通知
  },
}
```

通知の文言をカスタマイズする場合は `wallet/services/server/notification/adjustmentNotificationTemplate.ts` を編集する。

#### reserveBalance

残高を予約（ロック）。`locked_balance` を増加。

```typescript
const wallet = await walletService.reserveBalance(
  { userId, walletType, amount },
  tx?,
  { lock?: boolean }
);
```

#### releaseReservation

予約を解除。`locked_balance` を減少。

```typescript
const wallet = await walletService.releaseReservation(
  { userId, walletType, amount },
  tx?,
  { lock?: boolean }
);
```

#### consumeReservedBalance

予約済み残高を確定消費。`balance` と `locked_balance` を同時に減少。

```typescript
const result = await walletService.consumeReservedBalance(
  { userId, walletType, amount, sourceType, reason?, meta? },
  tx?,
  { lock?: boolean }
);
// result: { wallet: Wallet, history: WalletHistory }
```

---

## トランザクション統合

### 外部トランザクションとの統合

全ての操作関数は `tx?: TransactionClient` を受け取り、外部トランザクションに参加可能。

```typescript
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/features/core/wallet";

await db.transaction(async (tx: TransactionClient) => {
  // 複数操作を1トランザクション内で実行
  await walletService.adjustBalance(params1, tx);
  await walletService.adjustBalance(params2, tx);
  await someOtherService.doSomething(tx);
});
```

### 単独実行

`tx` を渡さなければ内部で新規トランザクションが作成される。

```typescript
// 単独で実行（内部でトランザクション作成）
await walletService.adjustBalance(params);
```

### 行ロック（lock オプション）

競合を防ぐため `SELECT FOR UPDATE` で行ロックを取得。

```typescript
// 行ロック付きで操作
await walletService.adjustBalance(params, tx, { lock: true });
await walletService.reserveBalance(params, tx, { lock: true });
```

---

## 残高予約フロー

### 概念

```
balance: 1000, locked_balance: 0
    ↓ reserveBalance(300)
balance: 1000, locked_balance: 300  ← 利用可能: 700
    ↓ consumeReservedBalance(300)
balance: 700, locked_balance: 0     ← 確定消費完了
```

### 利用可能残高

```
利用可能残高 = balance - locked_balance
```

### フロー図

```
┌─────────────────────────────────────────────────────────┐
│                    予約→確定フロー                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. reserveBalance      locked_balance += amount        │
│         ↓                                               │
│  2. 処理実行            （ガチャ、購入処理など）           │
│         ↓                                               │
│  3a. consumeReserved    balance -= amount               │
│      Balance            locked_balance -= amount        │
│                                                         │
│  3b. releaseReservation locked_balance -= amount        │
│      （失敗時）          （balance は変更なし）           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 実装例（ガチャ）

```typescript
async function playGacha(userId: string, cost: number) {
  return db.transaction(async (tx) => {
    // 1. 残高を予約
    await walletService.reserveBalance(
      { userId, walletType: "regular_point", amount: cost },
      tx,
      { lock: true }
    );

    try {
      // 2. ガチャ抽選
      const prize = await drawPrize();

      // 3. 予約を確定消費
      await walletService.consumeReservedBalance(
        {
          userId,
          walletType: "regular_point",
          amount: cost,
          sourceType: "user_action",
          reason: "ガチャプレイ",
          meta: { gachaId: prize.gachaId },
        },
        tx
      );

      return prize;
    } catch (error) {
      // 失敗時は予約解除
      await walletService.releaseReservation(
        { userId, walletType: "regular_point", amount: cost },
        tx
      );
      throw error;
    }
  });
}
```

---

## 通貨設定

### 設定ファイル

**`src/config/app/currency.config.ts`** で通貨の追加・変更を行う。

```typescript
// src/config/app/currency.config.ts
export const CURRENCY_CONFIG = {
  regular_coin: {
    slug: "coin",           // URLパス用（/wallet/coin）
    label: "コイン",         // 表示名
    unit: "コイン",          // 単位
    color: "#F59E0B",       // テーマカラー
    icon: CircleDollarSign, // アイコン（lucide-react）
    packages: [             // 購入パッケージ
      { amount: 500, price: 500 },
      { amount: 1000, price: 1000 },
    ],
    metaFields: [           // 管理画面の補足入力フィールド
      { name: "productId", label: "商品ID", formInput: "textInput" },
      { name: "notes", label: "メモ", formInput: "textarea", rows: 2 },
    ],
  },
  // 新しい通貨を追加する場合はここにエントリを追加
};
```

### 設定項目

| 項目 | 必須 | 説明 |
|------|------|------|
| `slug` | ✓ | URLパス用識別子 |
| `label` | ✓ | UI表示名 |
| `unit` | ✓ | 数値の単位（"pt", "コイン"など） |
| `color` | ✓ | テーマカラー（HEX） |
| `icon` | ✓ | lucide-reactアイコン |
| `packages` | ✓ | 購入パッケージ配列 |
| `metaFields` | ✓ | 管理画面用の補足フィールド（空配列可） |

### metaFields

管理画面でのポイント調整時に入力できる補足フィールド。

```typescript
metaFields: [
  {
    name: "productId",        // フィールド名（meta.productIdとして保存）
    label: "商品ID",          // 表示ラベル
    formInput: "textInput",   // "textInput" | "textarea"
    placeholder: "例: ITEM-001",  // プレースホルダー（任意）
    description: "説明文",        // フィールド説明（任意）
    rows: 2,                      // textarea時の行数（任意）
  },
]
```

### ユーティリティ関数

```typescript
import {
  getCurrencyConfig,
  getCurrencyConfigBySlug,
  getWalletTypeBySlug,
  getSlugByWalletType,
  getMetaFieldsByWalletType,
  isValidSlug,
} from "@/features/core/wallet/utils/currency";

// walletType から設定取得
getCurrencyConfig("regular_point");

// slug ↔ walletType 変換
getWalletTypeBySlug("point");         // → "regular_point"
getSlugByWalletType("regular_point"); // → "point"

// metaFields 取得
getMetaFieldsByWalletType("regular_coin");
// → [{ name: "productId", ... }, { name: "notes", ... }]
```

---

## 型のエクスポート

### barrel export（`@/features/core/wallet`）

```typescript
import type {
  // トランザクション
  TransactionClient,

  // オプション型
  WalletOperationOptions,   // { lock?: boolean }
  AdjustBalanceOptions,     // { lock?, skipHistory? }
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

---

## 履歴とメタ情報

### request_batch_id

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

### meta フィールド

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

### メタ情報のインデックス

頻繁に検索するキーにはGINインデックスを追加可能。

```sql
-- drizzle.ts または直接SQL
CREATE INDEX wallet_histories_meta_order_id_idx
ON wallet_histories USING gin ((meta ->> 'orderId'));
```

---

## 監査ログ（audit_logs）ポリシー

ウォレットには「**業務台帳としての wallet_histories**」と「**統制ログとしての audit_logs**」の **2 系統**の記録があり、責務が異なる。混同しないこと。

### 役割の違い

| 観点 | `wallet_histories` | `audit_logs` |
|------|-------------------|-------------|
| 目的 | 財務台帳（残高変動の元帳） | 統制・コンプラ・セキュリティトレイル |
| 何を残すか | 残高の前後値・delta・通貨種別・request_batch_id | 誰が（actor_type / actor_id / IP / UA / request_id）何をしたか |
| 対象 | **全ての残高変動** | **介入操作のみ** |
| 保持期間 | 業務上の要件で決定（通常は無期限） | retention_days で行単位制御（既定 365 / wallet は 730 日） |

### 「介入 (intervention)」と「業務 (business)」の判断軸

audit_logs に載せるのは **「介入」操作のみ**。「業務」操作は載せない。

**「介入」として audit に載せる**:

- 管理者が業務フロー外で手動操作する（actor_type=admin、admin 専用 API 経由）
- ポリシーを曲げる・緊急対応・手動修正・ユーザーの財産に直接介入する操作

**「業務」として audit に載せない**:

- システム設計通りに自動実行される高頻度処理（ガチャ消費、購入決済確定など）
- ユーザー操作の正常系（actor_type=user による課金・消費）
- 既に `wallet_histories` で財務的に追跡できているもの

**迷ったときの判断**:

- その関数が **admin から呼ばれる前提が 1 つでもあるか?** → Yes なら「介入」→ audit に載せる
- 同じ関数が admin / system 両方から呼ばれる場合: **載せる（actor_type で後から区別可能）**
- 件数規模が大きい bulk 介入は `aggregate` モード（1 ジョブ 1 行）で集約記録する

### ウォレット操作の対応一覧

| 操作 | 用途 | wallet_histories | audit_logs | action |
|------|------|------------------|-----------|--------|
| `adjustBalance` | **管理者による残高調整** | ✅ 記録 | ✅ 記録（介入） | `wallet.balance.adjusted` |
| `bulkAdjustByType` | **管理者による通貨種別単位の一括調整** | ✅ 記録（detail） | ✅ 1 行集約（aggregate） | `wallet.balance.bulk_adjusted_by_type` |
| `bulkAdjustByUsers` | **バッチジョブによるユーザー指定一括調整** | ✅ 記録（detail） | ✅ チャンク単位 1 行集約 | `wallet.balance.bulk_adjusted_by_users` |
| `clearBalance` | **ソフトデリート時の残高クリア** | ✅ 記録 | ✅ 記録（介入） | `wallet.balance.cleared` |
| `reserveBalance` | 残高予約（ロック） | — (残高変動なし) | ❌ 業務扱い | — |
| `releaseReservation` | 予約解除 | — (残高変動なし) | ❌ 業務扱い | — |
| `consumeReservedBalance` | 予約消費（購入決済確定など） | ✅ 記録 | ❌ 業務扱い | — |
| `debitBalance` | TX 内即時引落（クーポン適用など） | ✅ 記録 | ❌ 業務扱い | — |

### なぜ consume/debit を audit に載せないか

ガチャプレイ・購入決済確定などは高頻度な **業務フロー**であり、これを audit に載せると:

- 単位時間あたりの audit_logs 書き込みが爆発し、ストレージ・I/O コストが増大する
- 「介入」を検索するときに「業務」イベントに埋もれて統制目的が果たせなくなる
- ダウンストリーム側で既にドメイン履歴（ガチャプレイ履歴、購入履歴）を持っているケースが多く、三重記録になる

**業務イベントは `wallet_histories` とドメイン履歴で十分に追跡できる。audit はあくまで「介入」専用。**

### 保持期間（retention_days）

ウォレット系 audit は **730 日（2 年）** を採用。コンプライアンス対象ドメインとしての推奨値（[監査ログ採用ガイド](../../../../docs/how-to/監査ログ採用ガイド.md) 参照）。

各 wrapper 内で `WALLET_AUDIT_RETENTION_DAYS = 730` として定数化されている。

### 横展開：他ドメインで判断するとき

同じ「介入 vs 業務」の判断軸は他のドメイン（`userItem`、`couponGrant`、`subscription` 等）でも適用できる。詳しくは [監査ログ採用ガイド](../../../../docs/how-to/監査ログ採用ガイド.md) を参照。

---

## 有効期限（ロット管理）

「コインは取得から180日で失効」のような有効期限を通貨単位で有効化できる。
**デフォルトは全通貨で無効**であり、無効な通貨では一切の挙動変化がない（ロットテーブルへの書き込みもゼロ）。

### 仕組み

付与単位の台帳（`wallet_lots`）+ FIFO 消費によるロット会計。

- 付与（INCREMENT）のたびにロットを1本作成: `remaining = 付与額`, `expires_at = 付与時刻 + expirationDays`
- 消費（DECREMENT）のたびに失効日が近いロットから順（FIFO）に `remaining` を減算
- SET は取得時期の情報を破壊するため、全ロットを「現在取得扱い」の1本に置き直す（re-baseline）
- 不変条件: `SUM(wallet_lots.remaining) = wallets.balance`（全6経路の残高変更が同一TX内でロットを更新して維持）
- 失効スイープ（cron）が期限切れロットの残額を没収し、`wallet_histories`（reason_category: `expiration`）と audit に記録

残高が頻繁に増減しても、消費は常に最古ロットから引かれるため、失効するのは「本当に expirationDays の間使われずに残った分」だけ。

### 導入手順（ダウンストリーム）

1. `src/config/app/wallet-expiration.config.ts` で対象通貨を有効化:
   ```typescript
   regular_coin: { expirationDays: 180, sweepEnabled: true },
   ```
2. デプロイ後**すぐに**初期化を1回実行（既存残高を「実行日取得扱い」の初期ロット1本に変換）:
   ```bash
   pnpm task wallet-lots-init
   ```
   **注意**: config 有効化から初期化完了までの間、対象通貨の消費はロット不整合エラー（500）になる。低トラフィック帯に実施するか、メンテナンスモードを併用すること。
3. 失効スイープと prune のスケジュール登録を確認:
   ```
   30 4 * * *  → GET /api/cron/wallet-expire-lots （失効の没収）
   45 4 * * *  → GET /api/cron/wallet-lots-prune  （消費済みロットの掃除）
   ```
   両タスクは `vercel.json.example` に登録済みのため、これをコピーした `vercel.json` を持つ
   Vercel プロジェクトでは**追加作業なしで自動実行される**（未オプトインでも no-op なので害はない）。
   古い `vercel.json` を使っている場合は2行を追記する。Vercel 以外は任意のスケジューラから登録
   （`docs/reference/cron-tasks.md` 参照）。

   wallet-lots-prune は remaining = 0 になったロット行の物理削除。付与のたびに行が増えるため、
   **付与頻度が高いプロジェクトでは必須**（回さないと wallet_lots が単調増加する）。
   保持日数は `WALLET_LOT_PRUNE_RETENTION_DAYS`（デフォルト30日）で調整可能。

### 運用ルール

- **wallet-lots-init の再実行は失効カウントをリセットする**。導入時の1回だけ実行し、再実行は障害復旧時に限る
- **無効化→再有効化**: 無効化中は消費がロットに反映されないため、再有効化時は必ず `wallet-lots-init` を再実行して re-baseline すること
- **sweepEnabled: false**: ロット記録と失効間近照会だけ先行させ、没収は行わない（規約告知期間などに使用）
- **locked_balance 保護**: 失効額は利用可能残高（`balance - locked_balance`）が上限。予約中の分は失効せず次回スイープに持ち越し
- 規約側の文言は「失効は取得が古い順に充当（FIFO）」前提になっているか確認すること

### 失効間近の照会（失効予告 UI・通知のデータソース）

UI・通知はダウンストリーム所有。データレイヤとして以下を提供する。

```typescript
// サーバー: 本人の失効間近ロット（失効日ごとに集約）
const { lots, totalExpiring } = await walletService.getExpiringLots(userId, "regular_coin", 30);

// サーバー: 複数ユーザーの失効間近合計（通知バッチ用）
const summaries = await walletService.getExpiringSummaryByUsers(userIds, "regular_coin", 7);

// クライアント: 本人の失効間近残高（/api/me/wallet/expiring）
const { data } = useMyExpiringLots(userId, "regular_coin", 30);
// data: { lots: [{ expiresAt, amount }], totalExpiring, withinDays }
```

UI レシピ例（ダウンストリームで実装）:
- 残高ページに「うち ○○ コインが ○月○日 に失効します」バナー → `useMyExpiringLots` の `lots[0]`
- 失効7日前のメール通知バッチ → `getExpiringSummaryByUsers(userIds, type, 7)` で対象抽出

### 実装ファイル

- ロット会計（全経路から呼ばれる）: `services/server/lots/lotAccounting.ts`
- 失効スイープ: `services/server/lots/sweepExpiredLots.ts`
- 初期化: `services/server/lots/initWalletLots.ts`
- 照会: `services/server/lots/getExpiringLots.ts`
- 消費済みロットの prune: `services/server/lots/pruneConsumedLots.ts`
- 設定: `src/config/app/wallet-expiration.config.ts`

---

## 管理機能

### 管理API

```
POST /api/admin/wallet/{userId}/adjust
```

```json
{
  "walletType": "regular_point",
  "changeMethod": "INCREMENT",
  "amount": 5000,
  "reason": "キャンペーン補填",
  "meta": {
    "orderId": "ORDER-1234",
    "notes": "特別対応"
  }
}
```

### 管理UIコンポーネント

```typescript
import { AdminWalletAdjustModal } from "@/features/core/wallet/components/AdminWalletAdjustModal";
```

---

## ディレクトリ構造

```
src/features/core/wallet/
├── README.md                 # このファイル
├── index.ts                  # barrel export
│
├── entities/
│   ├── index.ts
│   ├── model.ts              # Wallet型定義
│   ├── schema.ts             # Zodスキーマ
│   ├── form.ts               # フォーム型
│   └── drizzle.ts            # Drizzleテーブル定義
│
├── services/
│   ├── types.ts              # パラメータ・オプション型
│   ├── client/               # クライアントサービス
│   │   └── walletClient.ts
│   └── server/
│       ├── walletService.ts  # メインサービス
│       ├── drizzleBase.ts    # ベースCRUD
│       ├── notification/
│       │   ├── adjustmentNotificationTemplate.ts  # 通知テンプレート（文言カスタマイズ用）
│       │   └── sendAdjustmentNotification.ts      # 残高変更通知の送信
│       └── wrappers/
│           ├── utils.ts      # ユーティリティ（getOrCreateWallet等）
│           ├── adjustBalance.ts
│           ├── reserveBalance.ts
│           ├── releaseReservation.ts
│           └── consumeReservedBalance.ts
│
├── hooks/                    # Reactフック
│   ├── useWallet.ts
│   ├── useWalletList.ts
│   └── useWalletBalances.ts
│
├── components/               # UIコンポーネント
│   ├── common/
│   │   └── CurrencyDisplay/
│   └── AdminWalletAdjustModal/
│
├── types/
│   ├── field.ts              # フィールド型（自動生成）
│   └── currency.ts           # 通貨設定の型定義
│
├── utils/
│   └── currency.ts           # 通貨設定ユーティリティ関数
│
└── constants/
    ├── field.ts              # 定数定義
    └── currency.ts           # 通貨設定から派生した定数
```

---

## トラブルシューティング

### Q. API呼び出しで500エラーが返る

サーバーログの `DomainError` を確認。よくある原因：
- 残高不足（409）
- バリデーションエラー（400）
- DB接続エラー（500）

### Q. 残高が更新されない / 表示が古い

- SWRの `revalidateKeys` を確認
- `mutate()` でキャッシュを手動更新

### Q. 「残高が不足しています」エラー

利用可能残高 = `balance - locked_balance` を確認。
予約中の残高がある場合、見かけ上の残高より少なくなる。

### Q. 大量更新時のパフォーマンス

- `meta` の頻出キーにGINインデックスを追加
- `request_batch_id` で絞り込んでから `meta` で検索

---

## 関連ドキュメント

- [コイン購入時の決済フローと外部決済連携](../../../docs/concepts/コイン購入時の決済フローと外部決済連携に関する処理方針.md)
- [WalletHistory ドメイン](../walletHistory/README.md)
