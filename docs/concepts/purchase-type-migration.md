# PurchaseRequest 汎用化対応（purchase_type 導入）

## 概要

`purchase_request` の「ウォレット加算」以外の用途（ダイレクト販売・物販・サブスク等）を扱えるよう、
`purchase_type` ディスクリミネータと「完了戦略レジストリ」を導入した。

- これまで: `wallet_type` が必須。完了処理は必ずウォレット加算を伴う前提だった。
- これから: `purchase_type` が完了処理の種別を決める。`wallet_type` は `wallet_topup` 以外で NULL 可。

下流プロジェクトは独自の `purchase_type` とそれに対応する `PurchaseCompletionStrategy` を登録することで、
ウォレット加算を伴わない購入（例: 景品のダイレクト販売）を `purchaseRequest` の決済セッション管理基盤に乗せられる。

---

## 変更内容サマリ

### 設定ファイル

- `src/config/app/purchaseType.config.ts` 【新規】
  - `PURCHASE_TYPE_CONFIG` マップ（ビルトイン: `wallet_topup` のみ）
  - 下流で `direct_sale` 等を追加する場合はこのファイルを編集

### DB スキーマ

- `purchase_requests` テーブル
  - 【追加】`purchase_type` 列（enum, NOT NULL, default `'wallet_topup'`）
  - 【変更】`wallet_type` を nullable 化
  - 【追加】`metadata` 列（JSONB, nullable）— 下流プロジェクト向け汎用メタデータ保持領域
  - 【追加】`purchase_requests_purchase_type_completed_at_idx` インデックス
  - `purchase_requests_wallet_type_completed_at_idx` は **温存**（Analytics 互換のため）

### サービス層

- `services/server/completion/` 【新規】
  - 戦略レジストリ（`registerPurchaseCompletionStrategy`）
  - ビルトイン戦略 `walletTopupStrategy`（旧ウォレット加算ロジックをそのまま移植）
- `services/server/wrappers/initiatePurchase.ts` 【変更】
  - パッケージ照合を戦略の `validateInitiation` に委譲
  - `purchase_type` をレコードに書き込む
- `services/server/wrappers/completePurchase.ts` 【変更】
  - ウォレット加算処理を戦略の `complete()` に委譲
  - 戻り値の `walletHistoryId` は nullable 化

### フック契約（下流に影響）

- `PurchaseCompleteHookParams.walletResult.history` を `WalletHistory | null` に変更
- 下流の独自フックが `walletResult.history.id` などを参照している場合、**TypeScript コンパイルエラー** が出る

---

## 下流プロジェクトの作業手順

所要時間の目安: **15〜30分/プロジェクト**

### 0. 事前確認

```bash
# processing 中の購入が残っていないことを確認
pnpm db:query "SELECT COUNT(*) FROM purchase_requests WHERE status = 'processing'"
```

0件になってから以下に進む（通常、pending は 30 分で自然に expired になる）。

### 1. メンテナンスモード ON

`src/proxies/maintenanceProxy.ts` が参照する ENV（`NEXT_PUBLIC_MAINTENANCE_MODE` 等）を有効化。

### 2. next-starter を pull / rebase

```bash
git pull upstream main
pnpm install
```

### 3. 独自フックの修正（使っていれば）

`src/features/core/purchaseRequest/services/server/hooks/definitions/` に独自の購入完了フックを登録している場合のみ。

**変更前:**

```ts
handler: async ({ purchaseRequest, walletResult, tx }) => {
  await addBonus(purchaseRequest.user_id, walletResult.history.id);
}
```

**変更後（推奨パターン）:**

```ts
handler: async ({ purchaseRequest, walletResult, tx }) => {
  // wallet_topup 購入のみ対象のフックなら冒頭で早期 return
  if (purchaseRequest.purchase_type !== "wallet_topup") return;
  if (!walletResult.history) return;
  await addBonus(purchaseRequest.user_id, walletResult.history.id);
}
```

TypeScript が `walletResult.history` の null 可能性を検出するため、**コンパイル時に修正漏れが発覚する** ようになっている。

### 4. DB スキーマ更新（db:push）

```bash
pnpm db:push
```

drizzle-kit が以下の変更を検出するので、確認の上 push する:

- `purchase_type` 列を追加（default `'wallet_topup'`、既存レコードはこの値で自動充填）
- `wallet_type` 列を nullable 化
- `purchase_requests_purchase_type_completed_at_idx` インデックスを追加

**既存データへの影響はゼロ**（既存レコードの `wallet_type` はそのまま、`purchase_type` が default で埋まる）。
データ移行スクリプトは不要。

### 5. デプロイ

通常のデプロイ手順でOK。

### 6. スモークテスト

- 通常のコイン購入を 1 件通して決済完了まで進むことを確認
- ウォレット残高が正しく加算されていることを確認
- 独自フック（ランクボーナス等）が従来通り動いていることを確認

### 7. メンテナンスモード OFF

---

## 下流プロジェクトで `direct_sale` 等の独自購入タイプを追加する方法

### 1. `PURCHASE_TYPE_CONFIG` にエントリを追加

`src/config/app/purchaseType.config.ts`:

```ts
export const PURCHASE_TYPE_CONFIG = {
  wallet_topup: {
    label: "ウォレット加算",
    requiresWalletType: true,
  },
  direct_sale: {
    label: "ダイレクト販売",
    requiresWalletType: false, // wallet_type を必須としない
  },
} as const satisfies Record<string, PurchaseTypeConfig>;
```

その後 `pnpm db:push` で enum 値を DB に反映。

### 2. 戦略を実装・登録

`src/features/core/purchaseRequest/services/server/completion/directSaleStrategy.ts` を新規作成:

```ts
import type { PurchaseCompletionStrategy } from "./types";
import { DomainError } from "@/lib/errors/domainError";

export const directSaleStrategy: PurchaseCompletionStrategy = {
  type: "direct_sale",

  validateInitiation: async ({ params }) => {
    // direct_sale 固有のバリデーション
    // 例: 商品IDの存在確認・在庫確認・価格照合など
    if (!params.providerOptions?.productId) {
      throw new DomainError("商品IDが必要です。", { status: 400 });
    }
  },

  complete: async ({ purchaseRequest, tx }) => {
    // direct_sale 固有の完了処理（在庫減算・配送手配等）
    // 戻り値の walletHistory は null（ウォレット加算なし）
    return { walletHistory: null };
  },
};
```

### 3. 副作用インポートで登録

`src/features/core/purchaseRequest/services/server/completion/index.ts` に追記:

```ts
import { registerPurchaseCompletionStrategy } from "./strategyRegistry";
import { walletTopupStrategy } from "./walletTopupStrategy";
import { directSaleStrategy } from "./directSaleStrategy";

registerPurchaseCompletionStrategy(walletTopupStrategy);
registerPurchaseCompletionStrategy(directSaleStrategy);
```

### 4. ダイレクト販売の購入リクエスト作成

通常の `initiatePurchase` を呼ぶだけ。`purchase_type` を明示指定する:

```ts
await initiatePurchase({
  userId,
  idempotencyKey: randomUUID(),
  purchaseType: "direct_sale", // ← 追加
  walletType: null,            // ← 不要なので null
  amount: 1,                    // 購入点数
  paymentAmount: 3000,          // 販売価格
  paymentMethod: "card",
  baseUrl,
  itemName: "限定フィギュア",
  providerOptions: { productId: "FIG-001" },
});
```

### 5. 独自フックの除外処理（既存 wallet_topup 向けフックがあれば）

既存の `rank_bonus` 等、`wallet_type` ガードで自然に除外されているフックは、念のため `purchase_type` ベースのガードに切り替えておくと将来的に安全:

```ts
handler: async ({ purchaseRequest, walletResult, tx }) => {
  if (purchaseRequest.purchase_type !== "wallet_topup") return;
  // ...
}
```

---

## `metadata` カラムの使い方と運用指針

`purchase_requests.metadata` は **JSONB 型の汎用メタデータ保持領域** で、下流プロジェクトが
purchase_type 固有の情報を opaque に格納するためのエスケープハッチ。
コアロジック（initiatePurchase / completePurchase / 各種フック）はこのフィールドの中身を
一切解釈しない。

### 書き込み・読み出し

```ts
// initiatePurchase 時に渡す
await initiatePurchase({
  purchaseType: "direct_sale",
  metadata: { directSaleId: "uuid-xxx", prizeItemId: "uuid-yyy" },
  // ...
});

// strategy.complete() で取り出す
const directSaleStrategy: PurchaseCompletionStrategy = {
  type: "direct_sale",
  complete: async ({ purchaseRequest, tx }) => {
    // 下流プロジェクトで型定義してキャスト（自己責任）
    const meta = purchaseRequest.metadata as {
      directSaleId: string;
      prizeItemId: string;
    };
    // meta.directSaleId を使って在庫減算・UserItem 作成など
    return { walletHistory: null };
  },
  // ...
};
```

### 冪等性・更新タイミング

- 新規作成: metadata はそのまま保存される
- pending リクエストの再利用（同じ idempotency_key で再呼び出し）: **metadata は上書き更新される**
  - 古い metadata は残らない
  - 商品差し替え等の再リトライで新しい内容を反映可能
- processing 以降: metadata は固定（initiatePurchase は既存フローを返すだけで更新しない）

### 何を `metadata` に入れるか vs サイドテーブルに切り出すか

**重要**: 「metadata 列があればサイドテーブルは不要」ではない。データの性質で使い分ける。

| データの性質 | 推奨 | 理由 |
|---|---|---|
| 外部キー（別テーブルのID） | サイドテーブル | FK 制約・CASCADE・リレーション検索 |
| 検索軸になる値（WHERE 条件で使う） | サイドテーブル | インデックス効率（JSONB は GIN 運用が重い） |
| 集計・分析に使う値 | サイドテーブル | Analytics クエリの書きやすさ |
| 非キーのスカラー（表示用の補足情報） | metadata OK | JSONB で十分 |
| 戦略内部で1回参照するだけの識別情報 | metadata OK | 戦略実行と同一トランザクションで完結 |
| ログ・監査目的の付帯情報 | metadata OK | 検索不要なら JSONB で十分 |

### 推奨パターン: サイドテーブル + metadata の併用

```
purchase_requests (共通スキーマ)
  ├─ id, user_id, purchase_type, ...
  └─ metadata: { customerNote: "...", displayLabel: "..." }  -- 非キー情報

direct_sale_purchases (ダイレクト販売の構造化データ)
  ├─ purchase_request_id UUID PRIMARY KEY REFERENCES purchase_requests(id) ON DELETE CASCADE
  ├─ direct_sale_id UUID NOT NULL REFERENCES direct_sales(id)
  ├─ prize_item_id UUID NOT NULL REFERENCES prize_items(id)
  └─ ...
```

- 外部キーや検索軸はサイドテーブルで厳密に型付け
- ちょっとしたスカラー補足は metadata

### 最初は metadata のみで始めてもよい

販売規模が小さい初期フェーズでは metadata に全部突っ込んで動かし始め、
- 検索軸が必要になったタイミング
- FK 制約が欲しくなったタイミング
- 集計クエリが複雑化したタイミング

でサイドテーブルに昇格させる運用もOK。その場合は metadata から該当フィールドを抜いて
サイドテーブルに移すマイグレーションを書く。

### 型安全性について

`metadata` の型は `unknown | null`。**下流プロジェクトで自己責任で型付け** する方針。

```ts
// 下流プロジェクトの完了戦略ファイル内
type DirectSaleMetadata = {
  directSaleId: string;
  prizeItemId: string;
};

const directSaleStrategy: PurchaseCompletionStrategy = {
  type: "direct_sale",
  validateInitiation: async ({ params }) => {
    // metadata のスキーマ検証も下流の責務
    const meta = params.metadata as DirectSaleMetadata | undefined;
    if (!meta?.directSaleId || !meta?.prizeItemId) {
      throw new DomainError("metadata に directSaleId と prizeItemId が必要です。", { status: 400 });
    }
  },
  complete: async ({ purchaseRequest, tx }) => {
    const meta = purchaseRequest.metadata as DirectSaleMetadata;
    // 以降は型付きで使える
  },
};
```

Zod 等でスキーマ検証を噛ませるのが堅い。upstream 側で型ジェネリクス化（`Strategy<TMetadata>`）は
現時点では実装していないが、将来必要になれば後から追加可能。

---

## 設計上の注意点

### `CURRENCY_CONFIG` に `"none"` を追加しない

かつて検討された「`wallet_type: "none"` を追加する」案は、以下の理由で採用していない:

- `wallet_type` の意味が「どのウォレットを加算するか」と「加算するか否か」の二重責務になる
- `CURRENCY_CONFIG` が通貨設定と非通貨マーカーの混在レジストリになる
- 別の非ウォレット購入タイプ（物販・サブスク等）を追加するたびに `"none_xxx"` が増える

代わりに `purchase_type` を一等市民に昇格させ、戦略レジストリで責務分離した。

### 戦略未登録はサイレント skip しない

`initiatePurchase` / `completePurchase` は、`purchase_type` に対応する戦略が登録されていない場合、
明示的に `DomainError` を投げる。**サイレントに成功扱いにしない**ことで、設定漏れを早期検知する。

### `amount` / `payment_amount` の意味

- `wallet_topup`: `amount` = 加算ポイント数 / `payment_amount` = 請求金額
- `direct_sale` 等: `amount` = 購入点数（または 1 固定） / `payment_amount` = 販売価格

意味は `purchase_type` に依存する。型としては両者とも `integer`。

### コールバック URL

現在の `initiatePurchase` は `wallet_type` 由来の slug でコールバック URL を組み立てる。
`wallet_type = null` の場合は空文字になるため、下流プロジェクトは以下のいずれかの対応を行うこと:

1. 独自の API route を用意してコールバックを受ける
2. `providerOptions` 経由でプロバイダ側にカスタム URL を渡す
3. 必要であれば upstream に「戦略別のコールバック URL 解決」機構の追加を提案する

---

## ロールバック手順

万一問題が発生した場合、以下の順序で戻せる:

1. デプロイを前バージョンに戻す
2. `wallet_type` の NOT NULL 制約を復活させる（`ALTER TABLE purchase_requests ALTER COLUMN wallet_type SET NOT NULL`）
   - ただし、この時点で既に `direct_sale` 等で `wallet_type = NULL` のレコードが作られていると不可能
   - メンテナンスモード内でのデプロイなら新規レコードゼロ件のはずなので戻せる
3. `purchase_type` 列を DROP

スモークテストで異常が見つかった時点で即座にメンテナンスモードのまま戻せるよう、
**デプロイ → スモークテスト → メンテ OFF の順序を厳守すること**。
