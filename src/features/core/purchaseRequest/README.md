# purchaseRequest ドメイン

外部決済を伴う購入（コイン購入など）の **決済セッション管理・状態遷移・二重購入防止** を担うドメイン。購入の「意図と状態」を `purchase_requests` に持ち、履行（ウォレット加算等）は `purchase_type` ごとの完了戦略に委譲する。

- 決済プロバイダの追加・ローカルでの動作確認: [services/server/payment/README.md](services/server/payment/README.md)
- 自社受付の銀行振込（`inhouse` プロバイダ。Webhook を持たない自己申告フロー）: [bankTransferReview README](../bankTransferReview/README.md)
- 残高・履歴（完了時の加算先）: [wallet README](../wallet/README.md)
- 期間内の購入金額上限: [purchaseQuota README](../purchaseQuota/README.md)

---

## 1. purchase_requests とステータス

`wallet_histories` は「完了した残高変更」しか表現できない。決済ページへ遷移中・決済処理中・失敗といった中間状態を持つため、専用テーブル `purchase_requests` を置いている（定義: `entities/drizzle.ts`）。

- 完了時のみ `wallet_histories` が作られ、`wallet_histories.request_batch_id = purchase_requests.id`、`purchase_requests.wallet_history_id` で相互に紐づく（`wallet_topup` の場合）
- `idempotency_key`: uuid, UNIQUE（二重購入防止の DB 層）
- `payment_method`: `payment.config.ts` の `paymentMethods[i].id`。完了時、プロバイダが返した実際の方法で上書きされる
- `payment_provider`: `resolveProviderForMethod()` で解決したプロバイダ名
- `payment_session_id` / `provider_order_id`: Webhook・ステータス照会で行を逆引きする照合キー（どちらを使うかはプロバイダの `correlationKey`）
- `purchase_type` / `metadata`: 「6. purchase_type と完了戦略」参照
- `expires_at`: 作成時に `getProviderSessionExpiryMinutes(provider)`（`providers[*].sessionExpiryMinutes`、未指定 30 分）から設定

### 状態遷移

許可表は `wrappers/transitionStatus.ts` の `ALLOWED_TRANSITIONS` が単一の真実。

```
pending ──(セッション作成)──→ processing ──(決済確定)──→ completed
   │                              │
   ├──→ failed                    ├──→ failed ──(Webhook 順序逆転の救済)──→ completed
   └──→ expired                   └──→ expired
```

- `failed → completed`: 「PENDING→失敗扱いの後に COMPLETED が届く」順序逆転を `completePurchase` が救済する
- `completed` / `expired` は終端。同じ冪等キーで `failed` / `expired` を再 initiate すると 400（新しい購入として開始させる）
- 独立した `cancelled` ステータスは無い:
  - 決済画面でのキャンセル: `failed`（`error_code = PAYMENT_ERROR_CODES.PAYMENT_CANCELLED` = `"payment_cancelled"`）
  - ユーザーによる取消（`cancelPurchase`）/ 期限切れ / ユーザー削除（`cancelPending`）: `expired`
- status 以外も同時に更新する（完了日時・取引 ID・戦略実行・関連レビュー更新を伴う） `completePurchase` / `failPurchase` / `cancelPurchase` は各自で楽観ロック付き UPDATE を持つ。status だけを動かす単純遷移は `transitionStatus()` を使う

---

## 2. ファイル構成（services/server）

```
purchaseRequestService.ts      — base CRUD + 購入フロー関数を束ねた公開サービス
cancelPending.ts               — ユーザー削除時に pending/processing を一括 expired（userCleanupRegistry から呼ばれる）
completion/                    — 完了戦略レジストリ + ビルトイン walletTopupStrategy
hooks/                         — 購入完了ポストフック（registerPurchaseCompleteHook、definitions/ に副作用 import で登録）
payment/                       — 決済プロバイダ実装（→ payment/README.md）
wrappers/
  purchaseService.ts           — 型定義 + re-export ハブ + getPurchaseStatus / getPurchaseStatusForUser
  initiatePurchase.ts          — 購入開始（resolveInitiation の結果を dispatch する薄いオーケストレータ）
  resolveInitiation.ts         — 既存リクエストに対し次に何をするかを決める純粋関数
  completePurchase.ts          — 購入完了（楽観ロック・戦略実行・クーポン・ポストフック・マイルストーン）
  failPurchase.ts              — 購入失敗（completed を上書きしない楽観ロック）
  cancelPurchase.ts            — ユーザー自身による取消（主に銀行振込案内画面から）
  expireStaleSessions.ts       — 放置された client_sdk 型 processing の掃除
  transitionStatus.ts          — ALLOWED_TRANSITIONS + 単純遷移ヘルパー
  webhookHandler.ts            — Webhook 処理（verifyWebhook → complete / fail に振り分け）
  purchaseHelpers.ts           — findByIdempotencyKey / findByWebhookIdentifier / 既存リクエストの応答構築 / expirePendingRequests
  recordBankTransferJudgment.ts — 振込明細画像の AI 判定結果を metadata に保存（bankTransferReview 用）
```

---

## 3. 決済フロー

### 3.1 購入開始（`POST /api/wallet/purchase/initiate` → `initiatePurchase`）

1. `isPaymentMethodSelectable(paymentMethod)`（`status="available"` かつ担当プロバイダが enabled）でなければ 400
2. プロバイダ解決: `params.paymentProvider`（明示指定）→ `resolveProviderForMethod(paymentMethod)`。解決失敗は config 不整合として 500
3. `findByIdempotencyKey(key, userId)`（**必ず user スコープ**）で既存を引き、`resolveInitiation` が分類する
   - `create`: 新規作成へ
   - `reuse-pending`: 同一 intent の未確定。金額・クーポンを再検証して再セッション
   - `resume`: 同一プロバイダで `processing`。redirect 型は保存済み `redirect_url` を返す、client_sdk 型は `createSession` を再実行（プロバイダ契約で冪等）
   - `completed`: 完了画面へ誘導
   - `conflict`: 別プロバイダで進行中 → 409 / `failed`・`expired` → 400
4. 新規作成時のみ `provider.validateInitiation`（inhouse の「未完了振込があれば既存案内へ戻す」等）
5. `PURCHASE_TYPE_CONFIG` と完了戦略を解決し `strategy.validateInitiation`（`wallet_topup` は `CURRENCY_CONFIG` のパッケージ照合）。**reuse-pending でも必ず再実行**（金額更新の経路で照合を飛ばすと金額詐称の穴になる）
6. `walletType` があれば保有上限チェック（`assertHoldingLimit`）
7. クーポン検証（`couponService.validateForCategory`、purchase_discount カテゴリ）→ 割引後金額 `<= 0` は 400
8. 1 tx で create（または pending 更新）+ `reserveQuota` +（新規時のみ）`strategy.afterInitiate`。新規作成の直前に `expireStaleClientSdkSessions(userId)` で同一ユーザーの放置 client_sdk processing を expired にする（best-effort）
9. `buildLaunchForRequest`: セッションエンリッチャー適用 → `provider.createSession` → `processing` に更新（`payment_session_id`、redirect 型のみ `redirect_url`、`deriveProviderOrderId` があれば `provider_order_id`）→ `LaunchInstruction` を返す

`baseUrl` は route で `getAppBaseUrl()` から作る（リクエストヘッダ由来の Host は使わない = Host Header Injection 対策）。

### 3.2 支払い後の 3 経路

```
[Webhook]   POST /api/webhook/payment?provider=<name>
            署名検証 → handleWebhook → verifyWebhook
              status "pending" → 何もせず 200
              success → completePurchase / それ以外 → failPurchase
[戻り]      successUrl / cancelUrl（既定: /api/wallet/purchase/callback）
            → /wallet/[slug]/purchase/callback（reason 付きなら /failed）へ 303
[ポーリング] callback ページの usePurchaseStatusPolling が GET /api/wallet/purchase/[id]/status
            → getPurchaseStatusForUser: processing ならプロバイダの getPaymentStatus に照会し
              completed → completePurchase / failed・expired → failPurchase
[確定 API]  client_sdk 型のみ: POST /api/wallet/purchase/[id]/<provider>/confirm（payment/README.md 参照）
```

- **残高付与は Webhook・ポーリング・確定 API の `completePurchase` だけが行う**。callback ルートはリダイレクトの振り分けのみで DB を見ない（Fincode の POST リダイレクトを GET に変換する役も兼ねる）
- Webhook はサーバー間・リトライ付きで確実性を、callback + ポーリングはユーザーへの即時フィードバックと Webhook 遅延の吸収を担う。両方必要
- ポーリング: 2 秒間隔・最大 30 回（60 秒）。completed → `/wallet/[slug]/purchase/complete`、failed / expired / タイムアウト → `/wallet/[slug]/purchase/failed`（`reason=expired|timeout` 等）
- ポーリング経路は `paidAmount` を渡さないため、金額照合は Webhook / 確定 API 経路でのみ効く
- コールバック URL の決定順: `params.successUrl/cancelUrl` → `strategy.buildCallbackUrls()` → wallet 既定（`/api/wallet/purchase/callback?request_id=…&wallet_type=<slug>`、cancel は `&reason=cancelled`）

画面: `/wallet/[slug]`（数量選択）→ `/wallet/[slug]/purchase`（確認・クーポン・支払い方法）→ `/purchase/callback` → `/purchase/complete` | `/purchase/failed`。銀行振込は `/purchase/bank-transfer/[requestId]`・`/purchase/awaiting-review`。

### 3.3 Webhook のエラー応答

- `?provider` 未指定・未知: 400 / 署名検証失敗: 401
- `completePurchase` / `failPurchase` の `DomainError`（409 競合・400 無効ステータス等）: `handleWebhook` が飲み込み 200（リトライ防止）
- route に届いた `DomainError`: 404（セッション不明）も含め 200
- それ以外（DB 障害等）: 500 → プロバイダにリトライさせる

### 3.4 completePurchase

1. `findByWebhookIdentifier(sessionId, providerName)`: `payment_session_id` → UUID なら `id` → プロバイダ固有リゾルバー（Fincode）
2. `completed` なら冪等に既存結果を返す / `processing`・`failed` 以外は 400
3. `paidAmount` があり `payment_amount` と不一致 → `markAsFatalFailure` で `failed` にしてから 400
4. tx: 楽観ロック（`WHERE status IN ('processing','failed')`、0 行なら 409）→ `commitQuota` → `strategy.complete()`（戻り値に walletHistory があれば `wallet_history_id` 記録）→ クーポン redeem（SAVEPOINT 隔離、失敗しても購入は完了させ `coupon_redeem_failed = true`）→ ポストフック（各 SAVEPOINT 隔離、失敗はログのみ）→ マイルストーン評価（達成分を `milestone_results` に保存、完了画面の通知に使う）
5. コミット後に `markUserDirty(user_id)`

**修復不能エラーの規約**: `handleWebhook` は `DomainError` を 200 で飲み込むため、status を動かさずに throw すると `processing` のまま塩漬けになり、ポーリングは 60 秒タイムアウトまで待つ。リトライしても直らないエラー（金額不一致など）を新設するときは、throw 前に必ず `markAsFatalFailure(id, code, message)` を呼ぶ（`WHERE status='processing'` 付きなので completed / failed を上書きしない）。「既に completed」「楽観ロック競合 409」「pending/expired 等の無効ステータス」では呼ばない。

### 3.5 failPurchase

- `completed` / `failed` なら何もせず返す（completed を絶対に上書きしない）
- 楽観ロック `WHERE status IN ('processing','pending')`（セッション作成直後の即失敗にも対応）
- `error_code` 未指定は `"PAYMENT_FAILED"`。`strategy.onFail` があれば同一 tx で実行。`releaseQuota`

### 3.6 期限切れ

- `expirePendingRequests()`: `status='pending' AND expires_at < now` を `expired` に（`processing` は対象外）+ `releaseQuota`
- 実行: dispatcher が 15 分ごとに `GET /api/cron/expire-pending-purchases`（`CRON_SECRET` 認証）を起動する（Vercel Hobby では 1 日 1 回）。手動は `pnpm task expire-pending-purchases`。セットアップは [src/lib/cron/README.md](../../../lib/cron/README.md)「スケジュールのセットアップ」

---

## 4. 二重購入防止（多層防御）

1 層だけに頼らず、発生パターンごとに止める層を決めている。

- ダブルクリック → **UI**: `useCoinPurchase` の `lockRef` で二重発火を抑止し、`isLoading` をボタンに渡してローディング表示（補助的）
- リロード・戻る・ネットワーク遅延による再送 → **API（冪等キー）**: `useCoinPurchase` は intent（支払い方法・ウォレット・金額）が変わるたびに uuid を発番し直す（クーポン変更では変えない = pending 再利用で金額更新）。サーバーは user スコープで既存を引き `resolveInitiation` で分類
- 複数タブ等の同時作成 → **DB**: `idempotency_key` UNIQUE
- Webhook 重複・Webhook とポーリングの競合 → **DB（楽観ロック）**: `WHERE status IN (...)` で 1 回だけ UPDATE が成功、0 行なら 409
- 処理済みの再送 → **Webhook 応答**: `DomainError` は 200 で返しプロバイダのリトライを止める。500 系のみリトライ対象

冪等キーを intent 由来にしている理由: 支払い方法を切り替えたときに別プロバイダの processing を掴む不具合を構造的に防ぐため。予測可能性によるなりすましは user スコープ検索で塞いでいる。

---

## 5. セキュリティ上の決めごと

- 金額はサーバー権威: パッケージ照合（戦略の `validateInitiation`）、割引後 `<= 0` の拒否、Webhook の `paidAmount` 照合
- `paymentMethod` は `isPaymentMethodSelectable` を通ったものだけ受け付ける（`coming_soon` / `disabled` の悪用防止）
- 冪等キー検索は必ず `user_id` でスコープ
- コールバック URL のオリジンは `getAppBaseUrl()`（`businessConfig.url` の直接参照・Host ヘッダ由来は禁止）
- `dummy` プロバイダは `NODE_ENV=production` で `getPaymentProvider` が throw
- PII を含むペイロード全量ログは `paymentConfig.debugLog`（本番 false）

---

## 6. purchase_type と完了戦略（ウォレット加算以外の購入）

`purchase_type` が完了処理の種別を決める。ビルトインは `wallet_topup` のみ。下流はダイレクト販売・物販・サブスク等を独自の `purchase_type` + 戦略として登録し、決済セッション管理基盤だけを再利用できる。`wallet_type` は `requiresWalletType: false` の型では NULL 可。

### 6.1 追加手順

1. `src/config/app/purchaseType.config.ts` の `PURCHASE_TYPE_CONFIG` にエントリを追加（`label`, `requiresWalletType`）。enum が変わるので `pnpm db:push`
2. `services/server/completion/<name>Strategy.ts` に `PurchaseCompletionStrategy` を実装
3. `completion/index.ts` で `registerPurchaseCompletionStrategy(<name>Strategy)`（`purchaseService.ts` が `completion` を副作用 import するので登録が走る）
4. 呼び出し側で `initiatePurchase({ purchaseType: "<name>", walletType: null, amount, paymentAmount, paymentMethod, baseUrl, metadata, ... })`

```ts
export const directSaleStrategy: PurchaseCompletionStrategy = {
  type: "direct_sale",
  validateInitiation: async ({ params }) => { /* 商品・在庫・価格の照合。不正は DomainError(400) */ },
  afterInitiate: async ({ purchaseRequest, tx }) => { /* 副次テーブルを同一 tx で作成 */ },
  complete: async ({ purchaseRequest, tx }) => {
    // 在庫減算・付与など。ウォレット加算しないなら null
    return { walletHistory: null };
  },
  onFail: async ({ purchaseRequest, errorCode, tx }) => { /* 副次テーブルを failed/cancelled に */ },
  onExpire: async ({ purchaseRequest, tx }) => { /* 副次テーブルを expired に */ },
  buildCallbackUrls: ({ purchaseRequest, baseUrl }) => ({
    successUrl: `${baseUrl}/direct-sale/complete?request_id=${purchaseRequest.id}`,
    cancelUrl: `${baseUrl}/direct-sale/cancel?request_id=${purchaseRequest.id}`,
  }),
};
```

- `amount` / `payment_amount` の意味は型依存（`wallet_topup`: 加算数 / 請求額、物販: 点数 / 販売価格）
- `wallet_type = null` の型は `buildCallbackUrls` を必ず実装する（未定義だと wallet 既定 URL の slug が空になり壊れる）
- 戦略未登録はサイレント skip せず `initiatePurchase` / `completePurchase` が `DomainError` を投げる（設定漏れの早期検知）
- `wallet_type: "none"` のような非通貨マーカーを `CURRENCY_CONFIG` に足す案は不採用: `wallet_type` が「どのウォレットか」と「加算するか」の二重責務になり、非ウォレット型が増えるたびにマーカーが増えるため

### 6.2 ライフサイクルフック（すべて optional）

- `afterInitiate`: 新規作成と同一 tx。throw すると purchase_request ごとロールバック（= 購入が始まらない、意図通り）。pending 再利用時は呼ばれないので冪等性不要
- `onFail`: `failPurchase` の `failed` 遷移と同一 tx。throw すると失敗マークも戻り塩漬けになる → 戦略側で握りつぶすか冪等な upsert で書く。ユーザーキャンセルとの区別は `errorCode === PAYMENT_ERROR_CODES.PAYMENT_CANCELLED`
- `onExpire`: `expirePendingRequests`（per-row tx、失敗はログしてスキップ）と `cancelPending`（呼び出し元 tx）から呼ばれる
- `onFail` / `onExpire` は Webhook リトライ・並行処理で複数回呼ばれ得るため idempotent に実装する（終端状態ならスキップするガード等）
- `cancelPurchase`（ユーザー取消 → `expired`）は戦略フックを呼ばない。取消時に副次テーブルの掃除が要る型はこの点に注意
- 性能: `onExpire` 未定義の型は bulk UPDATE 1 本、定義した型だけ per-row tx になる

### 6.3 metadata（JSONB）

`initiatePurchase({ metadata })` がそのまま保存し、`strategy.complete()` 等で `purchaseRequest.metadata` として読む。コアは中身を解釈しない（型は `unknown | null`、型付け・スキーマ検証は下流の責務。Zod 推奨）。

- 新規作成: 保存 / pending 再利用: **上書き**（古い値は残らない）/ processing 以降: 固定
- 置き場所の判断: 外部キー・検索軸（WHERE）・集計軸 → サイドテーブル（`purchase_request_id` を PK/FK にして `ON DELETE CASCADE`）。表示用の補足・戦略内で 1 回参照する識別子・検索しない監査情報 → metadata
- 小規模なうちは metadata だけで始め、検索・FK・集計が必要になった時点でサイドテーブルへ昇格させてよい
- コア自身も `bankTransferImageJudgment` キー（`BANK_TRANSFER_JUDGMENT_METADATA_KEY`、`recordBankTransferJudgment` が書く）を使う。下流のキーはこれと衝突させない

### 6.4 購入完了ポストフック

`services/server/hooks/definitions/` にフックを定義して `index.ts` から副作用 import する（`registerPurchaseCompleteHook({ key, handler })`）。`walletResult.history` は非ウォレット型で `null` になるため、ウォレット加算前提のフックは冒頭で `if (purchaseRequest.purchase_type !== "wallet_topup") return;` とする。

`purchase_type` 導入時（2026-04）の下流移行手順の記録: [docs/journal/2026-04-21--next-starter--purchase-type-migration.md](../../../../docs/journal/2026-04-21--next-starter--purchase-type-migration.md)
