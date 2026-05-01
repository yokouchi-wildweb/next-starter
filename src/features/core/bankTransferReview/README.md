# bankTransferReview ドメイン

自社受付の銀行振込（inhouse プロバイダ）における **振込完了申告とその管理者レビュー** を扱うドメイン。

外部決済プロバイダ（Square / Fincode / Stripe）は Webhook を起点に通貨付与が走るが、自社銀行振込は Webhook を持たず、ユーザー自身の自己申告と管理者による事後／事前確認で完結させる。本ドメインはその「申告レコードと審査ワークフロー」を独立した責務として管理する。

> **関連ドキュメント**: 共通の購入リクエスト基盤（外部決済プロバイダ・Webhook・楽観ロック等）は [docs/concepts/コイン購入時の決済フローと外部決済連携に関する処理方針.md](../../../../docs/concepts/コイン購入時の決済フローと外部決済連携に関する処理方針.md) を参照。

---

## 1. 概要

### 既存外部決済プロバイダとの違い

| 観点 | 外部決済プロバイダ (Square/Fincode 等) | 自社銀行振込 (inhouse) |
|---|---|---|
| 通貨付与の起点 | プロバイダからの Webhook | ユーザーの自己申告 API |
| 完了の確実性 | プロバイダ API が保証 | ユーザー申告の真偽は事後／事前確認に依存 |
| 有効期限 | 30 分（決済セッション） | 7 日（営業日跨ぎの振込に対応） |
| 識別子 | プロバイダの transaction_id 等 | `purchase_requests.provider_order_id`（8 桁数字） |
| 管理者の関与 | 通常は不要 | 必須（即時付与モードでも事後確認、確認モードでは承認が付与トリガ） |

### 動作モード

`paymentConfig.bankTransfer.autoComplete` で 2 モードを切り替える。レビューレコード作成時にモードが固定保存され、以後不変（途中で設定が変わっても既存レビューは作成時のモードで動く）。

| mode | 通貨付与のタイミング | 管理者承認の意味 | 拒否時の挙動 |
|---|---|---|---|
| `immediate` | ユーザー申告時に即時付与 | 事後の振込確認の意思表示（通貨は触らない） | レビュー status=rejected の記録のみ。通貨ロールバックは行わない |
| `approval_required` | 管理者承認時に付与 | 通貨付与のトリガ | failPurchase で status=failed（通貨は元から未付与） |

---

## 2. 全体フロー

### 即時モード (`autoComplete: true`)

```
[ユーザー]
  ├ 購入確認画面で「銀行振込」選択 + 購入ボタン
  │  └→ initiatePurchase → 振込案内 URL を redirectUrl で返す
  │
  ├ 振込案内ページで自分の振込先口座を確認、銀行へ振込
  │  └ 氏名末尾に identifier (8 桁数字) を付与
  │
  ├ 振込完了 → 画像をアップロード → 「申告」ボタン
  │  └→ POST /api/wallet/purchase/[id]/bank-transfer/confirm
  │      └→ submitReview (mode=immediate)
  │          ├ レビュー作成 (status=pending_review)
  │          ├ completePurchase 実行 → 通貨即時付与
  │          └ 完了画面へ遷移
  │
[管理者]
  ├ 管理画面で pending_review 一覧を確認
  ├ 振込明細画像を見て、銀行口座への入金を照合
  │  ├ 入金確認できた → 承認 (review.status=confirmed、通貨は触らない)
  │  └ 入金確認できない → 拒否 (review.status=rejected、通貨は触らない)
  │     └ 拒否後の通貨回収・ユーザー連絡は運用で別途対応
```

### 確認モード (`autoComplete: false`)

```
[ユーザー]
  ├ 購入確認画面で「銀行振込」選択 + 購入ボタン
  │  └→ initiatePurchase → 振込案内 URL を redirectUrl で返す
  │
  ├ 振込案内ページ → 振込実施 → 画像添付 → 「申告」ボタン
  │  └→ submitReview (mode=approval_required)
  │      ├ レビュー作成 (status=pending_review)
  │      ├ completePurchase は呼ばない（通貨は未付与のまま）
  │      └ 確認待ちページへ遷移
  │
[管理者]
  ├ 管理画面で pending_review 一覧を確認
  ├ 振込明細画像を見て、銀行口座への入金を照合
  │  ├ 入金確認できた → 承認 (completePurchase 実行 + review.status=confirmed)
  │  │   └ ユーザーに通貨が付与される
  │  └ 入金確認できない → 拒否 (failPurchase 実行 + review.status=rejected)
  │      └ purchase_request.status=failed
```

### 状態の組み合わせ

`purchase_requests.status` と `bank_transfer_reviews.status` は独立した 2 軸として動く。

| ケース | purchase_request.status | review.status | mode |
|---|---|---|---|
| 振込前 | processing | （レビュー無し） | - |
| 即時モード申告直後 | **completed** | pending_review | immediate |
| 即時モード承認後 | completed | confirmed | immediate |
| 即時モード拒否後 | completed (不変) | rejected | immediate |
| 確認モード申告直後 | processing | pending_review | approval_required |
| 確認モード承認後 | **completed** | confirmed | approval_required |
| 確認モード拒否後 | **failed** | rejected | approval_required |

---

## 3. 主要な設計判断

### なぜ独立ドメインに切り出したか

`purchase_requests` テーブルに「振込確認状態」「reviewer」「拒否理由」「画像 URL」等のカラムを追加する案もあったが、以下の理由で別テーブル + 別ドメインを選択した:

- `purchase_requests` の責務は「決済セッションの状態管理」であり、レビューは別概念。混ぜるとカラム数が膨張し、銀行振込以外のレコードでは null だらけになる
- 将来「再レビュー履歴」「複数管理者の関与」「コメントスレッド」等の拡張が出てきた場合、別ドメインに閉じている方が手を入れやすい
- 大規模化を想定し、ドメインの責務を明確に分離した方が新規開発者の認知負荷が低い

### なぜ mode をレコード作成時に固定保存するか

`paymentConfig.bankTransfer.autoComplete` の値は運用中に変更され得る。仮に「申告は即時モードで処理されたが、管理者承認時には設定が確認モードに変わっていた」場合、既存レビューの semantics が途中で変わってしまうとバグの温床になる。

レビュー作成時の `autoComplete` 値から決定した mode をレコードに固定することで、以下を保証:

- 1 レビュー = 1 モードで一貫した処理
- `paymentConfig.bankTransfer.autoComplete` の切り替えは **以後の新規申告にのみ影響** し、既存の pending_review レビューには影響しない

### なぜ拒否時に通貨ロールバックしないか（即時モード）

事業判断として、**「拒否」は意思表示の記録に留める** 設計にしている。理由:

- 即時モードでユーザーは既に通貨を消費している可能性が高い（数日〜数週間後に拒否判定するため）
- 自動回収を試みると残高不足ケースの取り扱いが複雑化する（マイナス残高許容 / 残債別管理 / 強制減算 + アカウント停止 等の選択が必要）
- 拒否後の対応（通貨回収・ユーザー連絡・アカウント停止判断）はケースバイケースで運用判断が必要

→ 拒否 API は `review.status=rejected` + `reject_reason` の記録のみ実施し、通貨操作は運用フローに委ねる。

確認モードの拒否は元から通貨未付与のため `failPurchase` でクリーンに失敗させる。

### なぜ画像 URL のパス完全一致まで検証するか

UI 側 (`useBankTransferProofUpload`) は固定パス `purchase-requests/bank-transfer-proofs/{requestId}` への上書きアップロード方針を採る。この前提を逆手に取って、サーバー側でパス完全一致まで踏み込んで検証する:

1. `getPathFromStorageUrl(url)` で Firebase Storage の正規 URL かを判定（任意の外部 URL 投入を防ぐ）
2. 抽出パスが本リクエスト専用パスと完全一致するかを判定（他ユーザーの画像 URL 流用を防ぐ）

これにより以下の攻撃を遮断:

- 任意の外部 URL を `proofImageUrl` として渡される
- 他ユーザーの振込画像 URL を流用される
- 別の自分の購入リクエストの画像 URL を使い回される

検証は `validateProofImageUrl()` (`utils/validateProofImageUrl.ts`) に集約。

### なぜ inhouseProvider 側で並行リクエストをブロックするか

同一ユーザーが「同じ銀行振込で複数の pending を持つ」状態は運用混乱を招く（どの purchase_request の振込か判別不能）。`inhouseProvider.validateInitiation` で「同一ユーザー × `bank_transfer_inhouse` × pending/processing」の既存があれば新規作成を阻止して既存リクエストへ誘導する。

クレジットカード等の他メソッドとは並行して購入できる（`payment_method` 等値で絞り込んでいるため）。

---

## 4. データモデル

### `bank_transfer_reviews` テーブル

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid (PK) | レビュー ID |
| `purchase_request_id` | uuid (FK, **UNIQUE**) | 関連購入リクエスト。1 対 1。purchase_request 削除時は cascade |
| `user_id` | uuid (FK) | 申告ユーザー。検索高速化と権限照合用に保持 |
| `status` | enum | `pending_review` / `confirmed` / `rejected` |
| `mode` | enum | `immediate` / `approval_required`（作成時固定） |
| `proof_image_url` | text (NOT NULL) | 振込明細画像の Firebase Storage URL |
| `submitted_at` | timestamp | ユーザー申告日時 |
| `reviewed_by` | uuid (FK, ON DELETE SET NULL) | レビュー実施管理者。退職時もレビュー履歴は残す |
| `reviewed_at` | timestamp (nullable) | レビュー実施日時 |
| `reject_reason` | text (nullable) | 拒否理由（confirmed では null） |
| `metadata` | jsonb (nullable) | 拡張用（再レビュー履歴・追加コメント等の将来余地） |
| `created_at`, `updated_at` | timestamp | 標準タイムスタンプ |

### インデックス

- `bank_transfer_reviews_status_idx` — 一覧画面の status タブ切替用
- `bank_transfer_reviews_user_id_idx` — ユーザー視点の進行中検出用
- `bank_transfer_reviews_submitted_at_idx` — 古い順 / 新しい順ソート用
- `purchase_request_id` の UNIQUE 制約により自動 index

### 関連

- `purchase_requests` (1) ─ `bank_transfer_reviews` (0..1)
- `users` (1) ─ `bank_transfer_reviews.user_id` (N) — 申告ユーザー
- `users` (1) ─ `bank_transfer_reviews.reviewed_by` (N) — レビュー実施管理者

### 既存スキーマへの影響

`purchase_requests` テーブルへのカラム追加は**一切なし**。本ドメインは新規テーブルとして独立しており、既存ロジック（楽観ロック・Webhook 順序逆転救済・売上集計クエリ等）への副作用ゼロ。

---

## 5. API リファレンス

### ユーザー向け

#### `POST /api/wallet/purchase/[id]/bank-transfer/confirm`
振込完了をユーザーが申告する。

**リクエスト**: `{ proofImageUrl: string }` (Firebase Storage の URL)

**レスポンス**:
```ts
{
  success: true;
  requestId: string;
  reviewId: string;
  mode: "immediate" | "approval_required";
  walletHistoryId: string | null;  // immediate モード時のみ非 null
  alreadyCompleted: boolean;       // 即時モードの再申告ケース
  redirectUrl: string;             // mode に応じた遷移先
}
```

**エラー**: 401 (未ログイン) / 400 (画像 URL 不正・status 不正・メソッド不一致) / 404 (リクエスト不在 or 別ユーザー)

#### `GET /api/wallet/purchase/bank-transfer/active`
**ユーザーがまだアクション必要な振込** を 1 件返す（バナー表示判定用）。

「ユーザーがアクション必要」の定義:
- 振込前 (`pre_submit`) — 両モード共通で「振込手続きをしてください」案内が必要
- 確認モードの申告済み (`pending_review` + `mode=approval_required`) — 通貨未付与で承認待ち

即時モード (`immediate`) の `pending_review` レビュー（管理者の事後確認待ち）は、
通貨は既に付与済みなのでユーザー視点では完了扱いとなり、active 検出の対象外。
管理画面側ではこれらも `pending_review` として一覧に出るので別軸の判定。

**レスポンス**:
```ts
{ active: null }
| {
    active: {
      purchaseRequestId: string;
      reviewId: string | null;     // 申告前は null
      status: "pre_submit" | "pending_review";
      mode: "immediate" | "approval_required" | null;
      submittedAt: string | null;
      redirectUrl: string;
    }
  }
```

### 管理者向け（`getRoleCategory(session.role) === "admin"` で保護）

#### `GET /api/admin/bank-transfer-reviews`
レビュー一覧。

**クエリ**: `status` / `mode` / `userId` / `dateFrom` / `dateTo` / `page` (1-based) / `limit` (default 20, max 100)

**レスポンス**: `{ items, total, page, limit }` — items は `review + purchaseRequest + user` を JOIN 済み

#### `GET /api/admin/bank-transfer-reviews/[id]`
レビュー詳細。

**レスポンス**: `{ review, purchaseRequest, user, reviewer }` — reviewer は判定済みの場合のみ非 null

#### `POST /api/admin/bank-transfer-reviews/[id]/confirm`
管理者承認。mode に応じて completePurchase 連動。

**レスポンス**: `{ success, review, walletHistoryId }`

#### `POST /api/admin/bank-transfer-reviews/[id]/reject`
管理者拒否。

**リクエスト**: `{ rejectReason: string }` (必須、500 文字以内)

**レスポンス**: `{ success, review }` — mode=approval_required 時は内部で failPurchase 実行

### クライアント関数

`@/features/core/bankTransferReview` から import:

- `getActiveBankTransfer()`
- `submitBankTransferProof({ purchaseRequestId, proofImageUrl })`
- `adminListBankTransferReviews({...})`
- `adminGetBankTransferReview(id)`
- `adminConfirmBankTransferReview(id)`
- `adminRejectBankTransferReview({ reviewId, rejectReason })`

`normalizeHttpError` を統一適用済み。UI 側は axios を直接書かない。

---

## 6. 設定

### `paymentConfig.bankTransfer`

```ts
{
  /** true: 申告時即時付与 / false: 管理者承認時付与 */
  autoComplete: boolean;
  account: {
    bankName: string;
    branchName: string;
    branchCode: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
  };
}
```

`getBankTransferConfig()` ヘルパーで取得。

### `paymentConfig.providers.inhouse`

```ts
{
  enabled: true,
  sessionExpiryMinutes: 60 * 24 * 7,  // 7 日
}
```

### `paymentConfig.paymentMethods`

```ts
{
  id: "bank_transfer_inhouse",
  label: "...",
  description: "...",
  icon: "bank",
  status: "available",
  provider: "inhouse",
}
```

> **注意**: `account` の値は事業者ごとに必ず本番値で上書きすること。デフォルトはサンプル値。

---

## 7. 監査ログ

すべての主要アクションは `audit_logs` テーブルに自動記録される。actor は `createApiRoute` 経由の AsyncLocalStorage から自動注入。

| action | 発生タイミング | before / after | metadata |
|---|---|---|---|
| `bank_transfer_review.review.submitted` | ユーザー申告（新規 or 再申告） | 既存レビューの status / proof_image_url ↔ 新しい状態 | `purchaseRequestId`, `isResubmission` |
| `bank_transfer_review.review.confirmed` | 管理者承認 | `status: pending_review` ↔ `status: confirmed` + reviewed_by | `purchaseRequestId`, `mode`, `walletHistoryId` |
| `bank_transfer_review.review.rejected` | 管理者拒否 | `status: pending_review` ↔ `status: rejected` + reviewed_by | `purchaseRequestId`, `mode` (reason には rejectReason) |

レビュー status 更新と audit 記録は同一トランザクション。audit 失敗時はレビュー更新もロールバックされる。

通貨付与（`completePurchase` 内の `walletService.adjustBalance`）の audit は wallet ドメイン側で別途記録される（`wallet.balance.changed` 系）。

---

## 8. UI 構成

### ユーザー側

| 画面 / コンポーネント | パス | 役割 | 実装状況 |
|---|---|---|---|
| 振込案内ページ | `src/app/(user)/(protected)/wallet/[slug]/purchase/bank-transfer/[requestId]/page.tsx` | 振込先口座・識別子・期限の表示 + 申告 CTA | 実装済 |
| 案内ページ本体コンポーネント | `src/features/core/purchaseRequest/components/BankTransferInstructionPage/` | 3 ステップ UI（口座情報 → 画像添付 → 申告） | 実装済 |
| 画像アップロードフック | `src/features/core/purchaseRequest/hooks/useBankTransferProofUpload.ts` | 固定パスへの上書きアップロード | 実装済 |
| 進行中振込バナー | `src/features/core/bankTransferReview/components/ActiveTransferBanner/` | ウォレットトップに表示する未完了振込の案内 | 実装済 |
| バナー用フック | `src/features/core/bankTransferReview/hooks/useActiveBankTransfer.ts` | `getActiveBankTransfer` のラッパー | 実装済 |
| 確認待ちページ | `src/app/(user)/(protected)/wallet/[slug]/purchase/awaiting-review/page.tsx` | 確認モードでの申告完了画面（管理者承認待ち） | **未実装** |

### 管理者側

| 画面 | パス | 役割 | 実装状況 |
|---|---|---|---|
| 一覧画面 | `src/app/admin/(protected)/bank-transfer-reviews/page.tsx` | status/mode フィルタ + ページネーション | **未実装** |
| 詳細モーダル | 上記内 | 画像拡大表示 + 承認/拒否アクション | **未実装** |

---

## 9. 関連ドメインへの相互参照

### purchaseRequest ドメイン

- **inhouseProvider** (`src/features/core/purchaseRequest/services/server/payment/inhouse/`): `createSession` で振込案内 URL を返す + `validateInitiation` で並行ブロック + `generateInhouseTransferIdentifier` で識別子生成
- **completePurchase** (`wrappers/completePurchase.ts`): submitReview (immediate) と confirmReview (approval_required) から呼ばれる。ウォレット加算・履歴・クーポン消化・マイルストーン評価を一括実行
- **failPurchase** (`wrappers/failPurchase.ts`): rejectReview (approval_required) から呼ばれる
- **initiatePurchase** (`wrappers/initiatePurchase.ts`): provider.validateInitiation を呼ぶ拡張ポイント、expires_at をプロバイダ別 (`getProviderSessionExpiryMinutes`) で算出

### wallet ドメイン

- `getSlugByWalletType()`: redirectUrl の組み立てに使用
- `walletService.adjustBalance()`: 通貨付与の実体（`completePurchase` 経由）

### auditLog ドメイン

- `auditLogger.record()`: 各アクションで呼ばれる

### lib/firebase

- `getPathFromStorageUrl()` (`src/lib/firebase/server/storage.ts`): 画像 URL 検証で使用

### lib/storage

- `directStorageClient.upload()`: 固定パス上書きアップロード（UI 側）

---

## 10. 運用上の注意

### 拒否時の手動対応フロー

即時モードで拒否したケースは、本ドメインは「拒否したという事実」しか記録しない。以下は運用側で実施:

1. ユーザーへの連絡（メール / 通知）
2. 通貨残高の手動調整（管理画面の残高調整機能を使用）
3. 不正常習者の場合はアカウント停止判断

`bank_transfer_reviews.reject_reason` と関連する `purchase_requests.payment_amount` を見て対応量を判断する。

### 孤児画像ファイルのクリーンアップ

`useBankTransferProofUpload` は固定パス上書き運用なので、申告完了したリクエストの画像は最新 1 件のみ Storage に残る。ただし「申告せず離脱したユーザーの画像」は孤児ファイルとして残る可能性がある。

→ **TODO**: cron で定期削除する仕組みを後追い実装する想定（現状未実装）。判定条件は「purchase_requests が `expired` or `failed` で、対応する画像が `purchase-requests/bank-transfer-proofs/{requestId}` に存在」。

### `autoComplete` 切替時の影響

`paymentConfig.bankTransfer.autoComplete` の切り替えは **以後の新規申告のみに影響**。既存の pending_review レビューは作成時の mode で動き続ける（mode はレコードに固定保存されているため）。

### 振込先口座の本番値設定

`paymentConfig.bankTransfer.account` のデフォルトはサンプル値。本番リリース前に必ず事業者の正規口座情報に書き換えること。

---

## 11. 既知の TODO

- [ ] 確認待ちページ (`/wallet/[slug]/purchase/awaiting-review`) の UI 実装
- [ ] 管理画面 (`/admin/bank-transfer-reviews`) の UI 実装
- [ ] 孤児画像ファイル削除 cron の実装
- [ ] ユニットテスト / E2E テスト
- [ ] 拒否時のユーザー通知連携（notification ドメインとの統合）

---

## ディレクトリ構成

```
src/features/core/bankTransferReview/
├── README.md                 # 本ドキュメント
├── index.ts                  # barrel export
├── entities/                 # スキーマ・モデル・Zod
│   ├── drizzle.ts            # bank_transfer_reviews テーブル定義
│   ├── schema.ts             # Zod スキーマ
│   ├── form.ts               # フォーム型
│   ├── model.ts              # TS 型
│   └── index.ts
├── constants/
│   └── storage.ts            # 固定パス prefix（UI 側と共通化用）
├── utils/
│   └── validateProofImageUrl.ts  # 画像 URL 検証
├── components/               # UI コンポーネント
│   └── ActiveTransferBanner/ # 進行中振込バナー
├── hooks/
│   └── useActiveBankTransfer.ts  # バナー用フック
└── services/
    ├── client/
    │   └── bankTransferReviewClient.ts  # axios クライアント
    └── server/
        ├── bankTransferReviewService.ts # re-export ハブ
        ├── drizzleBase.ts               # CRUD ベース
        └── wrappers/
            ├── submitReview.ts          # ユーザー申告
            ├── confirmReview.ts         # 管理者承認
            ├── rejectReview.ts          # 管理者拒否
            └── findHelpers.ts           # 検索ヘルパー
```
