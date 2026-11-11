# bankTransferReview ドメイン

自社受付の銀行振込（inhouse プロバイダ）における **振込完了申告とその管理者レビュー** を扱うドメイン。

外部決済プロバイダ（Square / Fincode / Stripe）は Webhook を起点に通貨付与が走るが、自社銀行振込は Webhook を持たず、ユーザー自身の自己申告と管理者による事後／事前確認で完結させる。本ドメインはその「申告レコードと審査ワークフロー」を独立した責務として管理する。

> **関連ドキュメント**: 共通の購入リクエスト基盤（外部決済プロバイダ・Webhook・楽観ロック等）は [purchaseRequest README](../purchaseRequest/README.md) を、プロバイダ実装の契約は [payment/README.md](../purchaseRequest/services/server/payment/README.md) を参照。

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

`purchaseRequestConfig.payment.bankTransfer.autoComplete` で 2 モードを切り替える。レビューレコード作成時にモードが固定保存され、以後不変（途中で設定が変わっても既存レビューは作成時のモードで動く）。

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

`purchaseRequestConfig.payment.bankTransfer.autoComplete` の値は運用中に変更され得る。仮に「申告は即時モードで処理されたが、管理者承認時には設定が確認モードに変わっていた」場合、既存レビューの semantics が途中で変わってしまうとバグの温床になる。

レビュー作成時の `autoComplete` 値から決定した mode をレコードに固定することで、以下を保証:

- 1 レビュー = 1 モードで一貫した処理
- `purchaseRequestConfig.payment.bankTransfer.autoComplete` の切り替えは **以後の新規申告にのみ影響** し、既存の pending_review レビューには影響しない

### なぜ拒否時に通貨ロールバックしないか（即時モード）

事業判断として、**「拒否」は意思表示の記録に留める** 設計にしている。理由:

- 即時モードでユーザーは既に通貨を消費している可能性が高い（数日〜数週間後に拒否判定するため）
- 自動回収を試みると残高不足ケースの取り扱いが複雑化する（マイナス残高許容 / 残債別管理 / 強制減算 + アカウント停止 等の選択が必要）
- 拒否後の対応（通貨回収・ユーザー連絡・アカウント停止判断）はケースバイケースで運用判断が必要

→ 拒否 API は `review.status=rejected` + `reject_reason` の記録のみ実施し、通貨操作は運用フローに委ねる。

確認モードの拒否は元から通貨未付与のため `failPurchase` でクリーンに失敗させる。

### 振込明細画像をどう守るか

画像は非公開の用途 `purchaseRequest.bankProof`（storageObject/purposes/purchaseRequest.ts）に置き、`proof_image_url` には storage ref を保存する。

1. アップロード（`useBankTransferProofUpload`）: `scopeId = requestId` で発行を求め、サーバーが「本人の・申告できる振込依頼か」を判定する（`isOwnPendingPurchaseRequest`）
2. 申告（`submitReview`）: base の storage binding（`services/server/drizzleBase.ts`）が保存と同じ TX で台帳に紐付ける。通るのは「アップロードした本人」「scopeId = この行の purchase_request_id」「未紐付け」の ref だけで、外れたら 400 で TX ごと巻き戻る
3. 閲覧: 固定 URL `/api/storage/objects/<id>` → 用途の read（依頼者本人か管理者）を毎回判定して短期署名へ 302

これにより以下を遮断する:

- 任意の外部 URL・新しい旧 URL を `proofImageUrl` として渡される（binding が ref 以外の新しい値を拒否）
- 他ユーザーの画像を流用される（本人以外の ref は紐付かない）
- 別の自分の購入リクエストの画像を使い回される（scopeId が一致しない）

- 再申告で差し替えた前の画像は deleted になり、実物は storage-sweep が消す
- 移行前に保存された旧 URL（Firebase Storage の URL）の行は、同じ値のまま保持できる（表示も従来どおり）

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
| `proof_image_url` | text (NOT NULL) | 振込明細画像の storage ref（`storage://priv/purchaseRequest.bankProof/…`。移行前の行は旧 Firebase Storage URL のまま） |
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

**リクエスト**: `{ proofImageUrl: string }` (`useBankTransferProofUpload` で上げた storage ref)

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

検出条件は **`purchase_request.status=processing`** を判定軸に置く（review status だけ
では不十分なため JOIN で絞り込む）:

| 状態 | active? | 誘導先 |
|---|---|---|
| 振込前 (review なし、purchase_request=processing) | ✅ | 振込案内ページ |
| 確認モード申告済み (pending_review + processing) | ✅ | 確認待ちページ |
| **即時モード申告済みで completePurchase 失敗** (pending_review + **processing**) | ✅ | 振込案内ページ (再申告で回復) |
| 即時モード正常完了 (pending_review + completed) | ❌ | — |
| 確認モード承認後の review 残り (pending_review + completed、稀) | ❌ | — |
| confirmed / rejected | ❌ | — |

即時モードで completePurchase が失敗した状態 (異常) もここで検出することで、ユーザーは
バナー → 振込案内ページ → 再申告 (画像差し替えで completePurchase 再試行) というルートで
自助回復できる。UI 側は mode + status の組み合わせで「再申告が必要」のメッセージを
出し分けることを推奨。

管理画面側では `pending_review` 全件を一覧表示するので別軸の判定（事後の振込確認は
管理者が実施）。

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
- ほか `adminInvestigateBankTransferReview` / `adminGetBankTransferReviewStatusCounts` / `adminUpdateBankTransferReviewAdminMemo` / `adminBulkImportBankTransferReviewCsv` / `adminBulkSendBankTransferReviewEmail`

管理画面の部品は client 関数を直に呼ばず、8 章の公開 hook を呼ぶ。`normalizeHttpError` を統一適用済み。UI 側は axios を直接書かない。

---

## 6. 設定

### 有効化（オプトイン・既定オフ）

本ドメインの管理画面（`/admin/bank-transfer-reviews/**`）・管理 API（`/api/admin/bank-transfer-reviews/**`）・管理メニュー「リクエスト管理 > 銀行振込レビュー」は、**決済方法 `bank_transfer_inhouse` が選択可能なときだけ露出する**。専用のフィーチャーフラグは持たず、`isPaymentMethodSelectable("bank_transfer_inhouse")`（`status === "available"` かつ `providers.inhouse.enabled`。決済の機能そのものの入切は門番の規則 `payment`）を判定源とする。

| 場所 | 無効時の挙動 |
|---|---|
| 管理メニュー（項目 `src/features/core/admin/menu/items/bankTransferReviews.ts`） | 行が閉じた住所で隠れ、行の無くなった「リクエスト管理」のカテゴリーも描かれない |
| Feature Gate (規則 `src/featureGate/rules/bankTransferReview.ts`・`payment.ts`。詳細 `src/featureGate/README.md`) | 管理画面は `/404` へ rewrite、管理 API は 404。決済の機能（規則 `payment`）が閉ならテーブル `bank_transfer_reviews` も作られない |
| ユーザー側 API（申告 / 進行中取得） | ゲート対象外。購入開始時点で選択不可メソッドが弾かれるため、進行中取得は `{ active: null }` を返すのみ |

上流の既定値は `status: "disabled"`。利用する fork は `purchaseRequestConfig.payment.paymentMethods` の `bank_transfer_inhouse` を `status: "available"` に変更する（これだけで購入画面・管理画面・API が揃って有効になる）。

### `purchaseRequestConfig.payment.bankTransfer`

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

### `purchaseRequestConfig.payment.providers.inhouse`

```ts
{
  enabled: true,
  sessionExpiryMinutes: 60 * 24 * 7,  // 7 日
}
```

### `purchaseRequestConfig.payment.paymentMethods`

```ts
{
  id: "bank_transfer_inhouse",
  label: "...",
  description: "...",
  icon: "bank",
  status: "disabled", // 上流既定。利用する fork は "available" に変更
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
| 案内ページ本体コンポーネント | `src/features/core/purchaseRequest/components/BankTransferInstruction/` | 3 ステップ UI（口座情報 → 画像添付 → 申告） | 実装済 |
| 画像アップロードフック | `src/features/core/purchaseRequest/hooks/useBankTransferProofUpload.ts` | 非公開の用途 purchaseRequest.bankProof へのアップロード（差し替え時は前の画像を取り消す） | 実装済 |
| 進行中振込バナー | `src/features/core/bankTransferReview/components/ActiveTransferBanner/` | ウォレットトップに表示する未完了振込の案内 | 実装済 |
| バナー用フック | `src/features/core/bankTransferReview/hooks/useActiveBankTransfer.ts` | `getActiveBankTransfer` のラッパー | 実装済 |
| 確認待ちページ | `src/app/(user)/(protected)/wallet/[slug]/purchase/awaiting-review/page.tsx` | 確認モードでの申告完了画面（管理者承認待ち / AI 判定不承認の要確認） | 実装済 |

### 管理者側

| 画面 / 部品 | パス | 役割 |
|---|---|---|
| 一覧画面(status ごとのタブ) | `src/app/admin/(protected)/bank-transfer-reviews/[status]/page.tsx` → `_screen/AdminBankTransferReviewsScreen.tsx` | URL のスラッグ(`STATUS_VALUE_BY_SLUG`)で status を決め、タブ・一覧・ページング・検索・CSV 一括判定 |
| タブ | `_screen/StatusTabs.tsx` | status 別件数付きのタブ(`useAdminBankTransferReviewStatusCounts`) |
| 一覧 | `_screen/BankTransferReviewListPanel.tsx` + `BankTransferReviewTable.tsx` | `useAdminBankTransferReviewList` と `useAdminBankTransferReviewMemo` を呼んで描く。一括操作は受け口 `adminBulkActions` の項目(既定 = メール一斉送信) |
| 詳細モーダル | `_screen/BankTransferReviewDetailModal.tsx` | `useAdminBankTransferReview` の詳細、`useAdminBankTransferReviewDecision` の承認 / 拒否 / 検証中への移行、管理者メモ |
| CSV 取り込み | `_screen/BankTransferReviewCsvImportDialog.tsx` | `useAdminBankTransferReviewCsvImport` を呼んで振込明細 CSV の dry-run と一括判定を描く |

`_screen` 部品は上流専用・約束なし(引数は足さない)。見た目を変える fork は同じルートの `_components/` の Screen で下の公開 hook を呼び、自分の markup で描く(処理は写さない)。

### 管理一覧の一括操作(受け口 `adminBulkActions`)

一覧の表の一括操作は受け口 `src/features/core/bankTransferReview/adminBulkActions/<名前>.tsx` の `export const bulkAction`(型 `BankTransferReviewAdminBulkActionItem` = `BulkActionItem<AdminBankTransferReviewListItem, AdminBulkActionAccess>`)。表は `useBankTransferReviewAdminBulkActions()` の項目を `BulkActionItems` で描くだけ。作り方は `src/lib/tableSuite/README.md`「一括操作の受け口」。

- 上流の既定の項目: `sendEmail`(order 100)= 選んだレビューの申告者への連絡の一括送信。連絡の作成関数 `bulkMessageAction`(`@/features/core/messaging/components/AdminBulkSend`)の上に置き、送り先は管理 API `POST /api/admin/messaging/bulk-send` の `target: "bankTransferReview"`。レビュー → 申告者の解決と送付履歴の管理者メモへの追記はサーバーの受け口の項目 `src/features/core/messaging/bulkSendTargets/bankTransferReview.ts`。既定の種別は transactional(振込の確認は業務の連絡)。送った回は `/admin/messaging` で見る
- fork: 項目を足す(例: 一括承認・一括拒否 = fork の route と hook を呼ぶ部品)、上流の項目を `sendEmail.override.ts` で外す・並べ替える(書けるのは `enabled`・`order`)
- 時機: 管理者が表で行を選んだ後に押す。選択は表示中のページ内だけ(ページ・タブ・検索語が変わると空になる)
- トランザクション: 受け口は持たない。1 回の操作の中身(API・サービスの tx)は項目が呼ぶ API の側
- 失敗: 項目の部品が toast などで出す。`onDone` は成功したときだけ呼ぶ(選択を外し、一覧と件数を取り直す)。権限の守りは API の側で、`access` は見せ方だけ
- 項目を置いた・消したら `pnpm generate extensions`(`extensions/adminBulkActions.ts` と intake の行)。テスト: `pnpm test src/features/core/bankTransferReview/hooks/adminBankTransferReviewBulkActions.test.tsx`

### 管理画面の公開 hook

`@/features/core/bankTransferReview/hooks/<名前>` から import する。SWR のキーは `hooks/adminBankTransferReviewKeys.ts`(`ADMIN_BANK_TRANSFER_REVIEW_KEYS` と組み立て関数、`refreshAdminBankTransferReviewCaches(mutate, kinds)`)の 1 か所。

| hook | 引数 | 戻り値 |
| --- | --- | --- |
| `useAdminBankTransferReviewStatusCounts({ searchQuery? })` | `searchQuery?: string`(省略 = URL の `?searchQuery=`) | SWR の戻り値(`data?.counts` = status ごとの件数) |
| `useAdminBankTransferReviewList({ status, searchQuery?, limit? })` | `status: BankTransferReviewStatus` / `searchQuery?: string`(省略 = URL の `?searchQuery=`) / `limit?: number`(既定 20、最大 100) | `{ data, items, total, totalPages, page, setPage, selectedKeys, setSelectedKeys, searchQuery, isLoading, error, refresh }` |
| `useAdminBankTransferReview(reviewId)` | `reviewId: string \| null`(null の間は取得しない) | `{ data, review, isLoading, error, refresh, walletEnabled }` |
| `useAdminBankTransferReviewMemo()` | なし | `{ save(reviewId, memo, messages?), savingId, isSaving }` |
| `useAdminBankTransferReviewDecision({ reviewId, onDone? })` | `reviewId: string` / `onDone?: () => void`(判定の成功の後) | `{ openDialog, open(dialog), close, confirm, reject, investigate, rejectReason, setRejectReason, rejectError, investigateNote, setInvestigateNote, investigateError, confirming, rejecting, investigating, busy }` |
| `useAdminBankTransferReviewCsvImport({ onDone? })` | `onDone?: () => void`(取り込みの実行の成功の後) | `{ csvText, fileName, fileResetKey, preview, errorRows, executed, isValidating, isSubmitting, selectFile(file), setText(text), removeFile, reset, validate, submit, downloadTemplate, downloadErrorRows }` |

- `useAdminBankTransferReviewList`: status か検索語が変わると 1 ページ目に戻して選択を空にし、ページを移ると選択を空にする(ページを跨いだ選択は持たない)。`refresh()` = 一覧と status 別件数を取り直す(承認・CSV 取り込み・一斉送信の後)
- `useAdminBankTransferReview`: `data` = 詳細 API の応答(`purchaseRequest` / `user` / `reviewer`)。`walletEnabled` = ウォレットの機能が開いているか(閉じているときは通貨の部品を使わず付与額を数字で出す)
- `useAdminBankTransferReviewMemo`: `save` はメモの前後の空白を落とし空なら null(削除)で送り、成功で success の toast と一覧・詳細の取り直しをして `true`、失敗は error の toast で `false`(投げない)。`messages = { saving?, success?, failure? }` で文言を替える(`saving` を渡すと保存中の loading の toast を出す)
- `useAdminBankTransferReviewDecision`: `openDialog` = 開いている確認(`"confirm"` / `"reject"` / `"investigate"` / null)。`close` はその確認の送信中は閉じない。reviewId が変わると確認・入力・誤りを初期化する。`reject` は拒否理由が空か `REJECT_REASON_MAX` 超えなら送らず `rejectError` に文言、`investigate` はメモが `INVESTIGATE_NOTE_MAX` 超えなら送らず `investigateError`(空は null で送る)。成功で success の toast・確認を閉じる・入力を空に・一覧 / 件数 / 詳細の取り直し・`onDone` で `true`、失敗は error の toast で `false`(確認は開いたまま)。確認文・警告文は部品の見た目
- `useAdminBankTransferReviewCsvImport`: `validate` = dry-run(空の CSV は送らない)で `preview` に行ごとの判定、`executed` を解く。`submit` = 実行(`preview` があり未実行のときだけ)。`fatalError` なら `executed` を立てず error の toast、成功で `executed`・success の toast・一覧 / 件数 / 詳細の取り直し・`onDone`。`selectFile` / `setText` / `removeFile` / `reset` で `preview` と `executed` を解く。`fileResetKey` はファイルの入力欄の `resetKey` に渡す
- 入力の上限 `REJECT_REASON_MAX`(500)/ `INVESTIGATE_NOTE_MAX`(500)/ `ADMIN_MEMO_MAX`(2000)は `constants/limits.ts`(barrel から export)。部品の「n / 上限」も同じ値を読む
- スラッグと status の対応表 `STATUS_SLUG_BY_VALUE` / `STATUS_VALUE_BY_SLUG`(`constants/statusSlug.ts`、server からも読める)と表示整形(`presenters.ts`: `formatBankTransferDate` / `formatJpyAmount` / `formatStatusLabel` / `statusBadgeVariant` ほか)は `@/features/core/bankTransferReview` から import する(`_screen` の `statusSlug.ts` / `formatters.ts` / `useStatusCounts.ts` は今までの import 先を壊さないための再 export)
- 単体テスト: `pnpm test src/features/core/bankTransferReview/hooks/`(読む側 `adminBankTransferReviewHooks.test.tsx`、操作 `adminBankTransferReviewActionHooks.test.tsx`)

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

### storageObject ドメイン / lib/storage

- `storageBindingFor()` (`features/core/storageObject`): `proof_image_url` の紐付け（drizzleBase）
- `uploadToStorage()` (`@/lib/storage/client`): 振込明細画像のアップロード（UI 側、`useBankTransferProofUpload` 経由）
- `resolveStorageSrc()` (`@/lib/storage`): 管理画面の表示で固定 URL に解決

---

## 10. 運用上の注意

### 拒否時の手動対応フロー

即時モードで拒否したケースは、本ドメインは「拒否したという事実」しか記録しない。以下は運用側で実施:

1. ユーザーへの連絡（メール / 通知）
2. 通貨残高の手動調整（管理画面の残高調整機能を使用）
3. 不正常習者の場合はアカウント停止判断

`bank_transfer_reviews.reject_reason` と関連する `purchase_requests.payment_amount` を見て対応量を判断する。

### 孤児画像ファイルのクリーンアップ

申告されなかった画像（差し替え前・申告せず離脱）は台帳上「未紐付けの ready」として残り、猶予（既定 24 時間）を過ぎると storage-sweep cron が消す。差し替え・クリア時は `useBankTransferProofUpload` がその場で取り消す。再申告で外れた前の画像も sweep が実物を消す。

移行前の固定パス `purchase-requests/bank-transfer-proofs/{requestId}` の旧画像は凍結（移行・削除しない）。

### `autoComplete` 切替時の影響

`purchaseRequestConfig.payment.bankTransfer.autoComplete` の切り替えは **以後の新規申告のみに影響**。既存の pending_review レビューは作成時の mode で動き続ける（mode はレコードに固定保存されているため）。

### 振込先口座の本番値設定

`purchaseRequestConfig.payment.bankTransfer.account` のデフォルトはサンプル値。本番リリース前に必ず事業者の正規口座情報に書き換えること。

---

## 11. 既知の TODO

- [x] 確認待ちページ (`/wallet/[slug]/purchase/awaiting-review`) の UI 実装
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
