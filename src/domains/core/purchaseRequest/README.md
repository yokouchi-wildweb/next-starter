# purchaseRequest ドメイン

## Overview

外部決済を伴う購入(コイン購入など)の決済セッションの管理・状態遷移・二重購入の防止を担うドメイン。購入の「意図と状態」を `purchase_requests` に持ち、履行(ウォレットの加算等)は `purchase_type` ごとの完了戦略に任せる。

- `wallet_histories` は「完了した残高変更」しか表せない。決済ページへ移る途中・決済の処理中・失敗という中間の状態を持つため、専用の表 `purchase_requests` を置く(定義: `entities/drizzle.ts`)
- 完了の時だけ `wallet_histories` が作られ、`wallet_histories.request_batch_id = purchase_requests.id`、`purchase_requests.wallet_history_id` で互いに紐づく(`wallet_topup` の場合)
- `purchase_type` が完了の処理の種別を決める。ビルトインは `wallet_topup` だけ。下流はダイレクト販売・物販・サブスク等を独自の `purchase_type` + 戦略として登録し、決済セッションの管理の基盤だけを使える。`wallet_type` は `requiresWalletType: false` の型では NULL 可
- 公開のサービス `purchaseRequestService`(`services/server/purchaseRequestService.ts`、base CRUD + 購入の流れの関数)。流れの本体は `services/server/wrappers/`、完了戦略の読み手は `completion/`、ポストフックは `hooks/`、決済プロバイダは `payment/`

### 状態遷移

許可表は `wrappers/transitionStatus.ts` の `ALLOWED_TRANSITIONS` が唯一の正。

```
pending ──(セッション作成)──→ processing ──(決済確定)──→ completed
   │                              │
   ├──→ failed                    ├──→ failed ──(Webhook 順序逆転の救済)──→ completed
   └──→ expired                   └──→ expired
```

- `failed → completed`: 「PENDING → 失敗扱いの後に COMPLETED が届く」順序の逆転を `completePurchase` が救う
- `completed` / `expired` は終端。同じ冪等キーで `failed` / `expired` を再 initiate すると 400(新しい購入として始めさせる)
- 独立した `cancelled` は無い: 決済画面でのキャンセル = `failed`(`error_code = PAYMENT_ERROR_CODES.PAYMENT_CANCELLED` = `"payment_cancelled"`)| ユーザーの取消(`cancelPurchase`)/ 期限切れ / ユーザー削除(`cancelPending`)= `expired`

## Usage

### 画面と支払いの後の 3 経路

画面: `/wallet/[slug]`(数量の選択)→ `/wallet/[slug]/purchase`(確認・クーポン・支払い方法)→ `/purchase/callback` → `/purchase/complete` | `/purchase/failed`。銀行振込は `/purchase/bank-transfer/[requestId]`・`/purchase/awaiting-review`。

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

- Webhook はサーバー間・リトライつきで確実さを、callback + ポーリングは利用者への即時の返しと Webhook の遅れの吸収を担う。両方要る
- ポーリング: 2 秒おき・最大 30 回(60 秒)。completed → `/wallet/[slug]/purchase/complete`、failed / expired / タイムアウト → `/wallet/[slug]/purchase/failed`(`reason=expired|timeout` 等)
- 画面の部品の通信: 振込明細画像の事前判定 = `useBankTransferImageJudge(requestId)`(`judge(file)`・`loading`・`error`・`rateLimit`。429 の残量は応答の `rateLimit` から)→ `POST /api/wallet/purchase/[id]/bank-transfer/judge-image`(応答の型 `types/bankTransferJudgment.ts`)| ダミー決済の画面 = `useDummyPayment({ sessionId, successUrl, cancelUrl, paymentMethod })` → `POST /api/webhook/payment?provider=dummy`

### 自前の購入の流れの callback

fork が自前の購入の流れ(例: 直販 `/direct-sale/purchase/...`)を持つとき、自分の callback 画面(`_components/`)からパスを渡して `usePurchaseStatusPolling` を呼ぶ。待ち表示は自前で描く:

```tsx
// src/app/(user)/(protected)/direct-sale/purchase/callback/_components/DirectSaleCallback.tsx（fork）
"use client";

import { useSearchParams } from "next/navigation";
import { usePurchaseStatusPolling } from "@/domains/core/purchaseRequest/hooks/usePurchaseStatusPolling";

export function DirectSaleCallback() {
  const requestId = useSearchParams().get("request_id");
  const { error, isPolling } = usePurchaseStatusPolling({
    requestId,
    slug: "coin", // パスを両方渡すと移り先には使われない
    completePath: "/direct-sale/purchase/complete",
    failedPath: "/direct-sale/purchase/failed",
  });
  // error / isPolling で待ち表示・エラーを描く
}
```

### purchase_type を足す

1. 上書き `src/config/domains/purchaseRequest.config.ts` の `purchaseType`(Extra で型も足す。既定は `config.ts`)に項目(`label`, `requiresWalletType`)を足す。enum が変わるので `pnpm db:push`
2. `services/server/completion/strategies/<name>.ts` に `export const strategy: PurchaseCompletionStrategy` を書く
3. `pnpm generate extensions`
4. 呼び手で `initiatePurchase({ purchaseType: "<name>", walletType: null, amount, paymentAmount, paymentMethod, baseUrl, metadata, ... })`

```ts
export const strategy: PurchaseCompletionStrategy = {
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

- `amount` / `payment_amount` の意味は型による(`wallet_topup`: 加算数 / 請求額、物販: 点数 / 販売価格)

## API

### purchase_requests の列

- `idempotency_key`: uuid, UNIQUE(二重購入の防止の DB 層)
- `payment_method`: `config.ts` の `payment` の `paymentMethods[i].id`。完了の時、プロバイダが返した実際の方法で上書きされる
- `payment_provider`: `resolveProviderForMethod()` で解いたプロバイダ名
- `payment_session_id` / `provider_order_id`: Webhook・状態の照会で行を逆に引く照合キー(どちらを使うかはプロバイダの `correlationKey`)
- `purchase_type` / `metadata`: 下の「完了戦略」「metadata」
- `expires_at`: 作る時に `getProviderSessionExpiryMinutes(provider)`(`providers[*].sessionExpiryMinutes`、未指定 30 分)から

### usePurchaseStatusPolling

`usePurchaseStatusPolling({ requestId, slug, completePath?, failedPath? })`(`hooks/usePurchaseStatusPolling.ts`)。両方の行き先を渡すときは slug を省ける。戻り値 `{ error, isPolling }`。

- `completePath`: 完了時の移り先のパス(省略 = `/wallet/<slug>/purchase/complete`)。`?request_id=<id>` を付けて移る
- `failedPath`: 失敗・期限切れ・タイムアウト時の移り先のパス(省略 = `/wallet/<slug>/purchase/failed`)。`request_id` に続けて `error_code`(failed、無ければ `UNKNOWN`)か `reason`(`expired` / `timeout`)を付ける
- パスに `?` があれば `&` で続ける(組み立ては純関数 `buildPurchaseResultUrl`)。core の `PurchaseCallback` は省略して呼ぶ(wallet の既定のまま)
- コールバック URL の決まる順: `params.successUrl/cancelUrl` → `strategy.buildCallbackUrls()` → wallet の既定(`/api/wallet/purchase/callback?request_id=…&wallet_type=<slug>`、cancel は `&reason=cancelled`)

### 完了戦略のライフサイクルフック(すべて optional)

- `afterInitiate`: 新規作成と同じ tx。throw すると purchase_request ごとロールバック(= 購入が始まらない)。pending の再利用では呼ばれない
- `onFail`: `failPurchase` の `failed` への遷移と同じ tx。throw すると失敗の印も戻り `processing` のまま残る。利用者のキャンセルとの区別は `errorCode === PAYMENT_ERROR_CODES.PAYMENT_CANCELLED`
- `onExpire`: `expired` への遷移すべてと同じ tx = `expirePendingRequests`(行ごとの tx、失敗はログしてスキップ)| `cancelPending`(呼び手の tx)| `cancelPurchase`(利用者の取消。throw すると取消ごとロールバック = 利用者にエラー)| `expireStaleClientSdkSessions`(行ごとの tx、失敗はログしてスキップ)。遷移の元は pending / processing のどちらもある
- `onFail` / `onExpire` は Webhook のリトライ・並行の処理で何度も呼ばれ得る
- 性能: `onExpire` の無い型は bulk UPDATE 1 本、ある型だけ行ごとの tx
- 戦略が登録されていなければ `initiatePurchase` / `completePurchase` が `DomainError` を投げる(黙って飛ばさない)
- `wallet_type = null` の型で `buildCallbackUrls` が無いと、wallet の既定の URL の slug が空になる

### metadata(JSONB)

`initiatePurchase({ metadata })` がそのまま保存し、`strategy.complete()` 等で `purchaseRequest.metadata` として読む。コアは中身を解釈しない(型は `unknown | null`)。

- 新規作成: 保存 / pending の再利用: 上書き(古い値は残らない)/ processing 以降: 固定
- 置き場の目安: 外部キー・検索の軸(WHERE)・集計の軸 → サイドテーブル(`purchase_request_id` を PK/FK にして `ON DELETE CASCADE`)。表示用の補足・戦略の中で 1 回参照する識別子・検索しない監査の情報 → metadata。小さいうちは metadata だけで始め、要る時にサイドテーブルへ上げてよい
- コア自身も `bankTransferImageJudgment` の鍵(`BANK_TRANSFER_JUDGMENT_METADATA_KEY`、`recordBankTransferJudgment` が書く)を使う

## Extension

- 設定: 持ち主 `config.ts`、上書き `src/config/domains/purchaseRequest.config.ts`(`payment` = 支払い方法・プロバイダ・Webhook の署名ヘッダー・`debugLog`、`purchaseType` = 購入の種類)。決済プロバイダの足し方は [services/server/payment/README.md](services/server/payment/README.md)
- 受け口 `completionStrategies`: `services/server/completion/strategies/<name>.ts` の `strategy`(Usage「purchase_type を足す」)
- 受け口 `completeHooks`(購入完了ポストフック): `services/server/hooks/definitions/<名前>.ts` に `export const hook: PurchaseCompleteHook`(`{ key, priority?, handler }`)を置き `pnpm generate extensions`。`walletResult.history` は非ウォレット型で `null`
- セッションのエンリッチャー(1 行スイッチ `sessionEnricher.ts`): 購入者の住所などをプロバイダに渡す(payment/README.md API)

## Internals

### 購入の開始(`POST /api/wallet/purchase/initiate` → `initiatePurchase`)

1. `isPaymentMethodSelectable(paymentMethod)`(`status="available"` かつ担当プロバイダが enabled)でなければ 400
2. プロバイダの解決: `params.paymentProvider`(明示)→ `resolveProviderForMethod(paymentMethod)`。解決の失敗は config の不整合として 500
3. `findByIdempotencyKey(key, userId)`(user のスコープ)で既存を引き、`resolveInitiation` が分ける
   - `create`: 新規作成へ
   - `reuse-pending`: 同じ intent の未確定。金額・クーポンを再検証して再セッション
   - `resume`: 同じプロバイダで `processing`。redirect 型は保存済みの `redirect_url` を返す、client_sdk 型は `createSession` を再実行(プロバイダの契約で冪等)
   - `completed`: 完了画面へ誘導
   - `conflict`: 別プロバイダで進行中 → 409 / `failed`・`expired` → 400
   - 購入の制限(財布の `purchaseRestriction`): `create`・`reuse-pending`・`resume` で、購入の種類(再開は既存の行の種類、`restrictedPurchaseType`)の type 設定が `requiresWalletType` なら wallet の `assertWalletPurchaseAllowed` を通す(必須で SMS 未認証は 403)。`completed`・`conflict` と財布を通らない種類は通さない
4. 新規作成の時だけ `provider.validateInitiation`(inhouse の「未完了の振込があれば既存の案内へ戻す」等)
5. `purchaseRequestConfig.type` と完了戦略を解いて `strategy.validateInitiation`(`wallet_topup` は `CURRENCY_CONFIG` のパッケージ照合)。reuse-pending でも再実行する
6. `walletType` があれば保有上限のチェック(`assertHoldingLimit`)
7. クーポンの検証(`couponService.validateForCategory`、purchase_discount カテゴリ)→ 割引後の金額 `<= 0` は 400。クーポンの機能が閉(`gate.enabled("coupon")` が false)のときにクーポンコードつきで来たら 400「クーポンは現在使えません。」。完了側も閉なら redeem を飛ばし warn 1 行
8. 1 tx で create(または pending の更新)+ `reserveQuota` +(新規の時だけ)`strategy.afterInitiate`。新規作成の直前に `expireStaleClientSdkSessions(userId)` で同じ利用者の放置された client_sdk の processing を expired にする(best-effort)
9. `buildLaunchForRequest`: セッションのエンリッチャー → `provider.createSession` → `processing` に更新(`payment_session_id`、redirect 型だけ `redirect_url`、`deriveProviderOrderId` があれば `provider_order_id`)→ `LaunchInstruction` を返す

- `baseUrl` は route で `getAppBaseUrl()` から作る(リクエストヘッダの Host は使わない)

### Webhook のエラー応答

- `?provider` 未指定・未知: 400 / 署名検証の失敗: 401
- `completePurchase` / `failPurchase` の `DomainError`(409 競合・400 無効な状態等): `handleWebhook` が飲み込み 200(リトライさせない)
- route に届いた `DomainError`: 404(セッション不明)も含め 200
- それ以外(DB 障害等): 500 → プロバイダにリトライさせる

### completePurchase

1. `findByWebhookIdentifier(sessionId, providerName)`: `payment_session_id` → UUID なら `id` → プロバイダ固有のリゾルバー(Fincode)
2. `completed` なら冪等に既存の結果を返す / `processing`・`failed` 以外は 400
3. `paidAmount` があり `payment_amount` と違う → `markAsFatalFailure` で `failed` にしてから 400
4. tx: 楽観ロック(`WHERE status IN ('processing','failed')`、0 行なら 409)→ `commitQuota` → `strategy.complete()`(戻り値に walletHistory があれば `wallet_history_id` を記録)→ クーポンの redeem(SAVEPOINT で隔離、失敗(例外、または期限切れ等で `success: false`)しても購入は完了させ `coupon_redeem_failed = true`)→ ポストフック(それぞれ SAVEPOINT で隔離、失敗はログだけ)→ マイルストーンの評価(達成分を `milestone_results` に保存、完了画面の通知に使う)
5. コミットの後に `markUserDirty(user_id)`

- `handleWebhook` は `DomainError` を 200 で飲み込むので、status を動かさずに throw すると `processing` のまま残り、ポーリングは 60 秒のタイムアウトまで待つ。`markAsFatalFailure(id, code, message)` は `WHERE status='processing'` つきで completed / failed を上書きしない
- `completePurchase` / `failPurchase` / `cancelPurchase` は status 以外も同時に更新する(完了日時・取引 ID・戦略の実行・関連のレビューの更新)ので、それぞれ楽観ロックつきの UPDATE を持つ。status だけを動かす単純な遷移は `transitionStatus()`
- ポーリングの経路は `paidAmount` を渡さないので、金額の照合は Webhook / 確定 API の経路でだけ効く
- callback のルートはリダイレクトの振り分けだけで DB を見ない(Fincode の POST リダイレクトを GET に変える役も兼ねる)

### failPurchase

- `completed` / `failed` なら何もせず返す
- 楽観ロック `WHERE status IN ('processing','pending')`(セッション作成の直後の即失敗にも効く)
- `error_code` 未指定は `"PAYMENT_FAILED"`。`strategy.onFail` があれば同じ tx で実行。`releaseQuota`

### 期限切れ

- `expirePendingRequests()`: `status='pending' AND expires_at < now` を `expired` に(`processing` は対象外)+ `releaseQuota`
- 実行: Vercel Cron が 15 分ごとに `GET /api/cron/expire-pending-purchases`(`CRON_SECRET` 認証)を呼ぶ(Vercel Hobby では 1 日 1 回。`vercel.json` の項目は `pnpm generate cron` が作る)。手動は `pnpm task expire-pending-purchases`。準備は [src/lib/cron/README.md](../../../lib/cron/README.md)「スケジュールのセットアップ」
- `cancelPending`: ユーザー削除の時に pending / processing をまとめて expired(user の受け口 cleanupHandlers から呼ばれる)

### 二重購入の防止(多層)

発生の形ごとに止める層を決めている。

- ダブルクリック → UI: `useCoinPurchase` の `lockRef` で二重の発火を止め、`isLoading` をボタンに渡す(補助)
- リロード・戻る・ネットワークの遅れによる再送 → API(冪等キー): `useCoinPurchase` は intent(支払い方法・ウォレット・金額)が変わるたびに uuid を出し直す(クーポンの変更では変えない = pending の再利用で金額を更新)。サーバーは user のスコープで既存を引き `resolveInitiation` で分ける
- 複数タブ等の同時作成 → DB: `idempotency_key` UNIQUE
- Webhook の重複・Webhook とポーリングの競合 → DB(楽観ロック): `WHERE status IN (...)` で 1 回だけ UPDATE が通り、0 行なら 409
- 処理済みの再送 → Webhook の応答: `DomainError` は 200 で返しプロバイダのリトライを止める。500 系だけリトライ
- 冪等キーを intent から作るのは、支払い方法を切り替えたときに別プロバイダの processing を掴まないため。予測できる鍵によるなりすましは user のスコープの検索で塞ぐ

### 守り

- 金額はサーバーが決める: パッケージの照合(戦略の `validateInitiation`)、割引後 `<= 0` の拒否、Webhook の `paidAmount` の照合
- `paymentMethod` は `isPaymentMethodSelectable` を通った物だけ(`coming_soon` / `disabled` の悪用を防ぐ)
- `dummy` プロバイダは段階が development(`@/lib/appEnv`)のときだけ使え、それ以外では `getPaymentProvider` が throw
- PII を含むペイロードの全量のログは `purchaseRequestConfig.payment.debugLog`

## Verification

- `pnpm test src/domains/core/purchaseRequest`(`hooks/usePurchaseStatusPolling.test.ts`・`hooks/usePurchaseStatusPolling.render.test.tsx`: URL の組み立て、既定・指定のパスで completed / failed / expired / timeout)
- 決済の結合の確かめ(dummy・ngrok・本番前): [services/server/payment/README.md](services/server/payment/README.md) Verification

## Related

- 決済プロバイダ: [services/server/payment/README.md](services/server/payment/README.md)
- 自社受付の銀行振込(`inhouse` プロバイダ、Webhook の無い自己申告の流れ): [bankTransferReview README](../bankTransferReview/README.md)
- 残高・履歴(完了時の加算先): [wallet README](../wallet/README.md)
- 期間内の購入金額の上限: [purchaseQuota README](../purchaseQuota/README.md)
- `purchase_type` 導入時(2026-04)の下流の移行手順の記録: [docs/journal/2026-04-21--next-starter--purchase-type-migration.md](../../../../docs/journal/2026-04-21--next-starter--purchase-type-migration.md)
