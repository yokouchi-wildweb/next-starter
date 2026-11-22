# bankTransferReview ドメイン

## Overview

- 自社受付の銀行振込（inhouse プロバイダ）の **振込完了申告とその管理者レビュー** を扱うドメイン
- 外部決済プロバイダ（Square / Fincode / Stripe）は Webhook を起点に通貨付与が走るが、自社銀行振込は Webhook を持たず、ユーザーの自己申告と管理者の事後／事前確認で完結する。本ドメインはその申告レコードと審査ワークフローを持つ

| 観点 | 外部決済プロバイダ (Square/Fincode 等) | 自社銀行振込 (inhouse) |
|---|---|---|
| 通貨付与の起点 | プロバイダからの Webhook | ユーザーの自己申告 API |
| 完了の確実性 | プロバイダ API が保証 | ユーザー申告の真偽は事後／事前確認に依存 |
| 有効期限 | 30 分（決済セッション） | 7 日（営業日跨ぎの振込に対応） |
| 識別子 | プロバイダの transaction_id 等 | `purchase_requests.provider_order_id`（8 桁数字） |
| 管理者の関与 | 通常は不要 | 必須（即時付与モードでも事後確認、確認モードでは承認が付与トリガ） |

### 動作モード

- `purchaseRequestConfig.payment.bankTransfer.autoComplete` で 2 モードを切り替える
- レビュー作成時にモードがレコードに固定保存され、以後不変（途中で設定が変わっても既存レビューは作成時のモードで動く。切り替えは以後の新規申告にだけ効く）
- AI 画像判定（`aiImageJudgmentEnabled`）が不合格・未判定のまま申告されたレビューは、設定が即時でも `approval_required` で作られ、status は `needs_check`（理由 `image_judgment_failed`）。申告には `unverifiedNote`（振込人名等のメモ）が要る

| mode | 通貨付与のタイミング | 管理者承認の意味 | 拒否時の挙動 |
|---|---|---|---|
| `immediate` | ユーザー申告時に即時付与 | 事後の振込確認の意思表示（通貨は触らない） | レビュー status=rejected の記録のみ。通貨ロールバックは行わない |
| `approval_required` | 管理者承認時に付与 | 通貨付与のトリガ | failPurchase で status=failed（通貨は元から未付与） |

## Usage

### 有効化（オプトイン・既定オフ）

- 上流の既定値は決済方法 `bank_transfer_inhouse` の `status: "disabled"`。使う fork は `purchaseRequestConfig.payment.paymentMethods` のそれを `status: "available"` にする（これだけで購入画面・管理画面・API が揃って有効になる）
- 専用のフィーチャーフラグは持たない。判定源は `isPaymentMethodSelectable("bank_transfer_inhouse")`（`status === "available"` かつ `providers.inhouse.enabled`）。決済の機能そのものの入切は門番の規則 `payment`

| 場所 | 無効時の挙動 |
|---|---|
| 管理メニュー（項目 `src/features/core/admin/menu/items/bankTransferReviews.ts`） | 行が閉じた住所で隠れ、行の無くなった「リクエスト管理」のカテゴリーも描かれない |
| Feature Gate (規則 `src/featureGate/rules/bankTransferReview.ts`・`payment.ts`。詳細 `src/featureGate/README.md`) | 管理画面は `/404` へ rewrite、管理 API は 404。決済の機能（規則 `payment`）が閉ならテーブル `bank_transfer_reviews` も作られない |
| ユーザー側 API（申告 / 進行中取得） | ゲート対象外。購入開始時点で選択不可メソッドが弾かれるため、進行中取得は `{ active: null }` を返すのみ |

### 振込先口座

- `purchaseRequestConfig.payment.bankTransfer.account` の既定はサンプル値

### 流れ: 即時モード (`autoComplete: true`)

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

### 流れ: 確認モード (`autoComplete: false`)

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

### 画面と部品（ユーザー側）

| 画面 / コンポーネント | パス | 役割 |
|---|---|---|
| 振込案内ページ | `src/app/(user)/(protected)/wallet/[slug]/purchase/bank-transfer/[requestId]/page.tsx` | 振込先口座・識別子・期限の表示 + 申告 CTA | 実装済 |
| 案内ページ本体コンポーネント | `src/features/core/purchaseRequest/components/BankTransferInstruction/` | 口座情報 → 画像添付 →（AI 判定）→ 申告。AI 判定が無効なら 3 ステップ |
| 画像アップロードフック | `src/features/core/purchaseRequest/hooks/useBankTransferProofUpload.ts` | 非公開の用途 purchaseRequest.bankProof へのアップロード（差し替え時は前の画像を取り消す） | 実装済 |
| 進行中振込バナー | `src/features/core/bankTransferReview/components/ActiveTransferBanner/` | ウォレットトップに表示する未完了振込の案内 | 実装済 |
| バナー用フック | `src/features/core/bankTransferReview/hooks/useActiveBankTransfer.ts` | `getActiveBankTransfer` のラッパー | 実装済 |
| 確認待ちページ | `src/app/(user)/(protected)/wallet/[slug]/purchase/awaiting-review/page.tsx` | 確認モードでの申告完了画面（管理者承認待ち / AI 判定不承認の要確認） | 実装済 |

### 画面と部品（管理者側）

| 画面 / 部品 | パス | 役割 |
|---|---|---|
| 一覧画面(status ごとのタブ) | `src/app/admin/(protected)/bank-transfer-reviews/[status]/page.tsx` → `_screen/AdminBankTransferReviewsScreen.tsx` | URL のスラッグ(`STATUS_VALUE_BY_SLUG`)で status を決め、タブ・一覧・ページング・検索・CSV 一括判定 |
| タブ | `_screen/StatusTabs.tsx` | status 別件数付きのタブ(`useAdminBankTransferReviewStatusCounts`) |
| 一覧 | `_screen/BankTransferReviewListPanel.tsx` + `BankTransferReviewTable.tsx` | `useAdminBankTransferReviewList` と `useAdminBankTransferReviewMemo` を呼んで描く。一括操作は受け口 `adminBulkActions` の項目(既定 = メール一斉送信) |
| 詳細モーダル | `_screen/BankTransferReviewDetailModal.tsx` | `useAdminBankTransferReview` の詳細、`useAdminBankTransferReviewDecision` の承認 / 拒否 / 検証中への移行、管理者メモ |
| CSV 取り込み | `_screen/BankTransferReviewCsvImportDialog.tsx` | `useAdminBankTransferReviewCsvImport` を呼んで振込明細 CSV の dry-run と一括判定を描く |

- `_screen` 部品は上流専用で約束なし。fork の Screen が呼ぶ公開 hook は `API.md`「管理画面の公開 hook」（client 関数は `normalizeHttpError` を統一適用済み）

### 拒否した後の運用（即時モード）

即時モードの拒否は「拒否したという事実」だけを記録する。以下は運用側で行う:

1. ユーザーへの連絡（メール / 通知）
2. 通貨残高の手動調整（管理画面の残高調整機能を使用）
3. 不正常習者の場合はアカウント停止判断

`bank_transfer_reviews.reject_reason` と関連する `purchase_requests.payment_amount` を見て対応量を判断する。

## API

- データモデル・HTTP API・クライアント関数・管理画面の公開 hook: `API.md`

## Extension

### 設定 `purchaseRequestConfig.payment.bankTransfer`

```ts
{
  /** true: 申告時即時付与 / false: 管理者承認時付与 */
  autoComplete: boolean;
  /** 申告前の AI 画像判定の段を出すか（false = 画像添付 → 即申告） */
  aiImageJudgmentEnabled: boolean;
  /** true: 振込人名・識別数字・金額の 3 点が読めなければ不合格（aiImageJudgmentEnabled のときだけ） */
  aiImageJudgmentStrictMode: boolean;
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

### 設定 `purchaseRequestConfig.payment.providers.inhouse`

```ts
{
  enabled: true,
  sessionExpiryMinutes: 60 * 24 * 7,  // 7 日
}
```

### 設定 `purchaseRequestConfig.payment.paymentMethods`

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

### 管理一覧の一括操作（受け口 `adminBulkActions`）

一覧の表の一括操作は受け口 `src/features/core/bankTransferReview/adminBulkActions/<名前>.tsx` の `export const bulkAction`(型 `BankTransferReviewAdminBulkActionItem` = `BulkActionItem<AdminBankTransferReviewListItem, AdminBulkActionAccess>`)。表は `useBankTransferReviewAdminBulkActions()` の項目を `BulkActionItems` で描くだけ。作り方は `src/lib/tableSuite/README.md`「一括操作の受け口」。

- 上流の既定の項目: `sendEmail`(order 100、文言「メール一斉送信」)= 選んだレビューの申告者へ連絡定義を送る。連絡の作成関数 `definitionBulkAction`(`@/features/core/messaging/components/DefinitionBulkAction`)で定義連絡の汎用の送るモーダルを記録の入口で置き(D194)、送り先は管理 API `POST /api/admin/messaging/definitions/send` の記録の入口 `recordTarget: "bankTransferReview.reviews"`。送る連絡定義は記録の宛先の `messages`(お振込の確認のご連絡、1 つなのでそれ)。レビュー → 申告者の解決(1 人 1 件、その人のレビューをまとめる)と送付履歴の管理者メモへの追記(メールを使った時だけ、D196)はこのドメインの記録の宛先 `recordTargets/reviews.ts`(`export const recordTarget: MessageRecordTarget`、鍵 = `bankTransferReview.reviews`。`pnpm generate registry` が `src/registry/recordTargetRegistry.ts` に集め、このドメインが閉じていれば messaging の門番が落とす)。送った回は `/admin/messaging` で見る
- お振込の確認のご連絡(上流の手本、D194): 連絡定義 `messages/transferCheck.ts`(鍵 `bankTransferReview.transferCheck`、レイアウト statement = メールは件名・本文、お知らせの一覧は短い本文。カテゴリー `bankTransferCheck` = 種別 transactional・メールとお知らせが既定で入、D165)。記録の宛先 `recordTargets/reviews.ts` の `messages` が名指し、管理の定義の送る口 `POST /api/admin/messaging/definitions/send` の記録の入口で送る(管理者は送る時にテキストを編集する)。記録から埋める値 `recordVars` = 宛名 `displayName`(名前が無ければ「お客様」)・金額 `paymentAmounts`・申告日 `submittedDates`(同じ人の審査はまとめるので「、」でつなぐ)。送った後(`afterSend`)は使う送信チャンネルに email がある時だけ、選んだ審査の管理メモに「YYYY/MM/DD「件名」メール送付」を足す(D196)
- fork: お振込の確認の文面は `messages/transferCheck.override.ts`(label・values など)、カテゴリーの送信チャンネルは `categories/bankTransferCheck.override.ts`、この一覧から送る連絡を足すのは `recordTargets/reviews.override.ts` の `messages`(並べる定義は `adminTargets` に `records`)
- fork: 項目を足す(例: 一括承認・一括拒否 = fork の route と hook を呼ぶ部品)、上流の項目を `sendEmail.override.ts` で外す・並べ替える(書けるのは `enabled`・`order`)
- 時機: 管理者が表で行を選んだ後に押す。選択は表示中のページ内だけ(ページ・タブ・検索語が変わると空になる)
- トランザクション: 受け口は持たない。1 回の操作の中身(API・サービスの tx)は項目が呼ぶ API の側
- 失敗: 項目の部品が toast などで出す。`onDone` は成功したときだけ呼ぶ(選択を外し、一覧と件数を取り直す)。権限の守りは API の側で、`access` は見せ方だけ
- 項目を置いた・消したら `pnpm generate extensions`（`extensions/adminBulkActions.ts` と intake の行）

## Internals

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
| AI 判定不合格の申告直後 | processing | needs_check（理由 `image_judgment_failed`） | approval_required |
| 要確認・検証中 | （元のまま） | needs_check / investigating（管理者の移行・CSV の金額不一致 `amount_mismatch`） | どちらも |

### 拒否の扱い

- 即時モードの拒否 API は `review.status=rejected` + `reject_reason` の記録だけで、通貨を回収しない（ユーザーが既に通貨を使っている見込み・残高不足の扱い・連絡や停止の判断は運用に委ねる）
- 確認モードの拒否は元から通貨未付与なので `failPurchase` で購入リクエストを失敗させる

### 振込明細画像の守り

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
- 申告されなかった画像（差し替え前・申告せず離脱）は台帳上「未紐付けの ready」として残り、猶予（既定 24 時間）を過ぎると storage-sweep cron が消す。差し替え・クリア時は `useBankTransferProofUpload` がその場で取り消す
- 移行前の固定パス `purchase-requests/bank-transfer-proofs/{requestId}` の旧画像は凍結（移行・削除しない）

### 並行する振込のブロック

- `inhouseProvider.validateInitiation` が「同一ユーザー × `bank_transfer_inhouse` × pending/processing」の既存があれば新規作成を止め、既存リクエストへ誘導する（どの購入リクエストの振込か判別できなくなるのを防ぐ）
- クレジットカード等の他メソッドとは並行して購入できる（`payment_method` の等値で絞るため）

### 監査ログ

- 主要アクションは `audit_logs` に記録される。actor は API ルートの Factory 経由の AsyncLocalStorage から自動で入る

| action | 発生タイミング | before / after | metadata |
|---|---|---|---|
| `bank_transfer_review.review.submitted` | ユーザー申告（新規 or 再申告） | 既存レビューの status / proof_image_url ↔ 新しい状態 | `purchaseRequestId`, `isResubmission` |
| `bank_transfer_review.review.confirmed` | 管理者承認 | `status: pending_review` ↔ `status: confirmed` + reviewed_by | `purchaseRequestId`, `mode`, `walletHistoryId` |
| `bank_transfer_review.review.rejected` | 管理者拒否 | `status: pending_review` ↔ `status: rejected` + reviewed_by | `purchaseRequestId`, `mode` (reason には rejectReason) |
| `bank_transfer_review.review.flagged_needs_check` | 要確認への移行（CSV の金額不一致など） | status ↔ `needs_check` + 理由 | 理由の詳細 |
| `bank_transfer_review.review.flagged_investigating` | 管理者の検証中への移行 | status ↔ `investigating` | note |
| `bank_transfer_review.admin_memo.changed` | 管理者メモの変更 | admin_memo | - |
| `bank_transfer_review.review.cancelled` | 利用者が購入リクエストを取り消した（purchaseRequest の cancelPurchase） | `status: pending_review` ↔ `status: rejected` + 取り消しの理由 | `purchaseRequestId`, `mode`, `cancelledByUser` |

- レビューの status 更新と audit の記録は同一トランザクションで、audit が失敗するとレビューの更新も巻き戻る
- 通貨付与（`completePurchase` 内の `walletService.adjustBalance`）の audit は wallet ドメイン側で記録される（`wallet.balance.changed` 系）

### 関連ドメインとの接点

#### purchaseRequest ドメイン

- **inhouseProvider** (`src/features/core/purchaseRequest/services/server/payment/inhouse/`): `createSession` で振込案内 URL を返す + `validateInitiation` で並行ブロック + `generateInhouseTransferIdentifier` で識別子生成
- **completePurchase** (`wrappers/completePurchase.ts`): submitReview (immediate) と confirmReview (approval_required) から呼ばれる。ウォレット加算・履歴・クーポン消化・マイルストーン評価を一括実行
- **failPurchase** (`wrappers/failPurchase.ts`): rejectReview (approval_required) から呼ばれる
- **initiatePurchase** (`wrappers/initiatePurchase.ts`): provider.validateInitiation を呼ぶ拡張ポイント、expires_at をプロバイダ別 (`getProviderSessionExpiryMinutes`) で算出

#### wallet ドメイン

- `getSlugByWalletType()`: redirectUrl の組み立てに使用
- `walletService.adjustBalance()`: 通貨付与の実体（`completePurchase` 経由）

#### auditLog ドメイン

- `auditLogger.record()`: 各アクションで呼ばれる

#### storageObject ドメイン / lib/storage

- `storageBindingFor()` (`features/core/storageObject`): `proof_image_url` の紐付け（drizzleBase）
- `uploadToStorage()` (`@/lib/storage`): 振込明細画像のアップロード（UI 側、`useBankTransferProofUpload` 経由）
- `resolveStorageSrc()` (`@/lib/storage`): 管理画面の表示で固定 URL に解決

## Verification

- 管理画面の公開 hook: `pnpm test src/features/core/bankTransferReview/hooks/`（読む側 `adminBankTransferReviewHooks.test.tsx`、操作 `adminBankTransferReviewActionHooks.test.tsx`）
- 一括操作の受け口: `pnpm test src/features/core/bankTransferReview/hooks/adminBankTransferReviewBulkActions.test.tsx`

## Related

- 共通の購入リクエスト基盤（外部決済プロバイダ・Webhook・楽観ロック等）: `src/features/core/purchaseRequest/README.md`
- プロバイダ実装の契約: `src/features/core/purchaseRequest/services/server/payment/README.md`
- 一括操作の受け口の作り方: `src/lib/tableSuite/README.md`「一括操作の受け口」
- 門番の規則: `src/featureGate/README.md`
