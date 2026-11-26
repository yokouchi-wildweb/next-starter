# bankTransferReview — API

## Overview

- bankTransferReview の API(データの形・HTTP・クライアント関数・管理画面の公開 hook)の参照。概要と使い方は `README.md`

## API

### データモデル: `bank_transfer_reviews` テーブル

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid (PK) | レビュー ID |
| `purchase_request_id` | uuid (FK, **UNIQUE**) | 関連購入リクエスト。1 対 1。purchase_request 削除時は cascade |
| `user_id` | uuid (FK) | 申告ユーザー。検索高速化と権限照合用に保持 |
| `status` | enum | `pending_review` / `needs_check` / `investigating` / `confirmed` / `rejected` |
| `mode` | enum | `immediate` / `approval_required`（作成時固定） |
| `proof_image_url` | text (NOT NULL) | 振込明細画像の storage ref（`storage://priv/purchaseRequest.bankProof/…`。移行前の行は旧 Firebase Storage URL のまま） |
| `submitted_at` | timestamp | ユーザー申告日時 |
| `reviewed_by` | uuid (FK, ON DELETE SET NULL) | レビュー実施管理者。退職時もレビュー履歴は残す |
| `reviewed_at` | timestamp (nullable) | レビュー実施日時 |
| `approval_source` | text (nullable) | 承認の経路 `manual` / `csv_auto`（未承認・拒否は null） |
| `reject_reason` | text (nullable) | 拒否理由（confirmed では null） |
| `admin_memo` | text (nullable) | 管理者の自由メモ |
| `needs_check_reason` | text (nullable) | 要確認の理由 `amount_mismatch` / `image_judgment_failed`。確定後も残す |
| `needs_check_context` | jsonb (nullable) | 理由の詳細（例 `amount_mismatch` = `{ csvAmount, expectedAmount }`）。コアは中身を解釈しない |
| `metadata` | jsonb (nullable) | 拡張用（コアは中身を解釈しない） |
| `created_at`, `updated_at` | timestamp | 標準タイムスタンプ |

#### インデックス

- `bank_transfer_reviews_status_idx` — 一覧画面の status タブ切替用
- `bank_transfer_reviews_user_id_idx` — ユーザー視点の進行中検出用
- `bank_transfer_reviews_submitted_at_idx` — 古い順 / 新しい順ソート用
- `purchase_request_id` の UNIQUE 制約により自動 index

#### 関連

- `purchase_requests` (1) ─ `bank_transfer_reviews` (0..1)
- `users` (1) ─ `bank_transfer_reviews.user_id` (N) — 申告ユーザー
- `users` (1) ─ `bank_transfer_reviews.reviewed_by` (N) — レビュー実施管理者
- `purchase_requests` テーブルへのカラム追加は無い

### HTTP: ユーザー向け

#### `POST /api/wallet/purchase/[id]/bank-transfer/confirm`
振込完了をユーザーが申告する。

**リクエスト**: `{ proofImageUrl: string, unverifiedNote?: string }`（`proofImageUrl` = `useBankTransferProofUpload` で上げた storage ref。`unverifiedNote` は AI 判定が不合格・未判定のとき必須、500 文字以内）

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

#### `POST /api/wallet/purchase/[id]/bank-transfer/judge-image`
申告前に振込明細の画像を AI が判定する（`aiImageJudgmentEnabled` のとき）。

**リクエスト**: multipart の `file`

- 合否はサーバーで決め `purchase_requests.metadata` に残す。`/confirm` はこの保存値で合否を確かめる
- 利用者ごとの回数の上限あり（直近 15 分の失敗・直近 24 時間の試行）

### HTTP: 管理者向け(管理者のロール区分で保護)

#### `GET /api/admin/bank-transfer-reviews`
レビュー一覧。

**クエリ**: `status` / `mode` / `userId` / `dateFrom` / `dateTo` / `page` (1-based) / `limit` (default 20, max 100)

**レスポンス**: `{ items, total, page, limit }` — items は `review + purchaseRequest + user` を JOIN 済み

#### `GET /api/admin/bank-transfer-reviews/status-counts`
status ごとの件数（タブ用）。

**クエリ**: `searchQuery`（任意。一覧と同じ検索を当てる）

#### `GET /api/admin/bank-transfer-reviews/[id]`
レビュー詳細。

**レスポンス**: `{ review, purchaseRequest, user, reviewer }` — reviewer は判定済みの場合のみ非 null

#### `POST /api/admin/bank-transfer-reviews/[id]/confirm`
管理者承認。mode に応じて completePurchase 連動。

**レスポンス**: `{ success, review, walletHistoryId }`

#### `POST /api/admin/bank-transfer-reviews/[id]/investigate`
検証中（`investigating`）へ移す。

**リクエスト**: `{ note?: string }`（500 文字以内）

#### `PATCH /api/admin/bank-transfer-reviews/[id]/admin-memo`
管理者メモを書き換える。

**リクエスト**: `{ adminMemo?: string | null }`

#### `POST /api/admin/bank-transfer-reviews/bulk/import-csv`
振込明細 CSV で一括判定する。

**リクエスト**: `{ csvText: string, dryRun: boolean }`（`dryRun: true` は判定の下見だけ）

#### `POST /api/admin/bank-transfer-reviews/[id]/reject`
管理者拒否。

**リクエスト**: `{ rejectReason: string }` (必須、500 文字以内)

**レスポンス**: `{ success, review }` — mode=approval_required 時は内部で failPurchase 実行

### クライアント関数

`@/domains/core/bankTransferReview` から import:

- `getActiveBankTransfer()`
- `submitBankTransferProof({ purchaseRequestId, proofImageUrl })`
- `adminListBankTransferReviews({...})`
- `adminGetBankTransferReview(id)`
- `adminConfirmBankTransferReview(id)`
- `adminRejectBankTransferReview({ reviewId, rejectReason })`
- ほか `adminInvestigateBankTransferReview` / `adminGetBankTransferReviewStatusCounts` / `adminUpdateBankTransferReviewAdminMemo` / `adminBulkImportBankTransferReviewCsv` / `adminBulkSendBankTransferReviewEmail`

### 管理画面の公開 hook

`@/domains/core/bankTransferReview/hooks/<名前>` から import する。SWR のキーは `hooks/adminBankTransferReviewKeys.ts`(`ADMIN_BANK_TRANSFER_REVIEW_KEYS` と組み立て関数、`refreshAdminBankTransferReviewCaches(mutate, kinds)`)の 1 か所。

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
- `useAdminBankTransferReviewDecision`: `openDialog` = 開いている確認(`"confirm"` / `"reject"` / `"investigate"` / null)。`close` はその確認の送信中は閉じない。reviewId が変わると確認・入力・誤りを初期化する
  - `reject` は拒否理由が空か `REJECT_REASON_MAX` 超えなら送らず `rejectError` に文言、`investigate` はメモが `INVESTIGATE_NOTE_MAX` 超えなら送らず `investigateError`(空は null で送る)
  - 成功で success の toast・確認を閉じる・入力を空に・一覧 / 件数 / 詳細の取り直し・`onDone` で `true`、失敗は error の toast で `false`(確認は開いたまま)。確認文・警告文は部品の見た目
- `useAdminBankTransferReviewCsvImport`: `validate` = dry-run(空の CSV は送らない)で `preview` に行ごとの判定、`executed` を解く。`submit` = 実行(`preview` があり未実行のときだけ)。`fatalError` なら `executed` を立てず error の toast、成功で `executed`・success の toast・一覧 / 件数 / 詳細の取り直し・`onDone`。`selectFile` / `setText` / `removeFile` / `reset` で `preview` と `executed` を解く。`fileResetKey` はファイルの入力欄の `resetKey` に渡す
- 入力の上限 `REJECT_REASON_MAX`(500)/ `INVESTIGATE_NOTE_MAX`(500)/ `ADMIN_MEMO_MAX`(2000)は `constants/limits.ts`(barrel から export)。部品の「n / 上限」も同じ値を読む
- スラッグと status の対応表 `STATUS_SLUG_BY_VALUE` / `STATUS_VALUE_BY_SLUG`(`constants/statusSlug.ts`、server からも読める)と表示整形(`bankTransferReviewPresenters.ts`: `formatBankTransferDate` / `formatJpyAmount` / `formatStatusLabel` / `statusBadgeVariant` ほか)は `@/domains/core/bankTransferReview` から import する(`_screen` の `statusSlug.ts` / `formatters.ts` / `useStatusCounts.ts` は今までの import 先を壊さないための再 export)
