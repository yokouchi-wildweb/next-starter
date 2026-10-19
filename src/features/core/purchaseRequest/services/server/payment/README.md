# 決済プロバイダ（payment/）

`PaymentProvider` 契約の実装群と、新しいプロバイダの追加手順・ローカルでの動作確認方法。購入フロー全体（状態遷移・Webhook / ポーリング / 二重購入防止）は [purchaseRequest README](../../../README.md) を参照。

プロバイダ個別ガイド: [square/](square/README.md) | [paidy/](paidy/README.md)（client_sdk）| [paypal/](paypal/README.md)（client_sdk）。自社銀行振込 `inhouse` は [bankTransferReview README](../../../../bankTransferReview/README.md)。

---

## 1. 設計方針

- **契約で抽象化**: プロバイダ差分は `PaymentProvider`（`types/payment.ts`）の中に閉じる。購入フロー側にプロバイダ名の分岐を書かない（照合キーは `correlationKey`、order ID は `deriveProviderOrderId`、再起動方法は `launchType` で宣言する）
- **1 支払い方法 = 1 プロバイダ**: `payment.config.ts` の `paymentMethods[i].provider` が唯一の真実。`resolveProviderForMethod()` で解決し、担当の切替は config 書き換えだけで済む（選択用の環境変数は無い）
- **起動方式は値で多態化**: `createSession` は `LaunchInstruction`（`redirect` | `client_sdk`）を返し、クライアントの `executePaymentLaunch`（`services/client/launchers/`）が type で分岐する。新しい起動方式は union に variant + handler を足す
- **Webhook は 3 分岐**: `PaymentResult.status` = `completed` / `failed` / `pending`。成功でも確定失敗でもないものは全部 `pending`（無視して 200）
- **金額照合**: `verifyWebhook` は実課金額を `paidAmount` で返し、`completePurchase` が `payment_amount` と照合する

### 起動方式の 2 系統

最初にどちらかを判定する。追加ファイル数と動線が違う。

- **redirect 型**（stripe / fincode / square / inhouse / dummy）: `{ type: "redirect", url }` を返し、プロバイダのホスト型ページ（inhouse は自社の案内ページ）へ遷移。確定 = Webhook（+ ポーリング）。再 initiate 時は保存済み `redirect_url` を再利用
- **client_sdk 型**（paidy / paypal）: `{ type: "client_sdk", sdkName, config }` を返し、同一ページで JS SDK のモーダル / ボタンを起動。確定 = クライアントからの確定 API（+ Webhook がフォールバック）。外部 URL を持たないため、再 initiate 時は `createSession` を再実行してモーダルを再展開する

---

## 2. PaymentProvider 契約（要点）

正は `src/features/core/purchaseRequest/types/payment.ts`。

- `providerName`
- `launchType: "redirect" | "client_sdk"`（必須）
- `correlationKey: "session_id" | "order_id"`（必須）: Webhook / ステータス照会で行を引くキー。`session_id` = `payment_session_id`（既定）、`order_id` = `provider_order_id`（Fincode）
- `deriveProviderOrderId?(purchaseRequestId)`: 独自の order 識別子を持つ場合に実装。`initiatePurchase` が `provider_order_id` に自動保存する
- `createSession(params)`: **同一 `purchaseRequestId` に対して冪等であること**（client_sdk の resume が再実行するため。外部副作用があるなら idempotency key で同じ Order を再利用。例: PayPal `PayPal-Request-Id=order_${id}`）
- `verifyWebhook(request)` → `PaymentResult`（`status`, `sessionId`, `transactionId`, `paymentMethod`, `paidAt`, `paidAmount`, `errorCode`, `errorMessage`）。`status` 未指定時は `success` で判定（後方互換）
- `verifyWebhookSignature?(request, signature)`: 本文解析前の署名検証。`timingSafeEqual` で比較する
- `getPaymentStatus?(id, paymentMethod?)`: ポーリング用照会。`id` は `correlationKey` で選ばれた値。未実装ならポーリングでは確定しない（Webhook 待ち）
- `validateInitiation?(ctx)`: 新規作成直前のプロバイダ固有チェック。`{ kind: "redirect", existing }` を返すと新規作成せず既存へ誘導（inhouse の「未完了振込があれば案内ページへ戻す」）。外部プロバイダは通常不要

`CreatePaymentSessionParams` の主な値: `purchaseRequestId`, `amount`（割引後）, `paymentMethod`（`paymentMethods[i].id`）, `successUrl` / `cancelUrl`, `buyerEmail` / `buyerPhoneNumber`（E.164）, `providerOptions`, `purchaseType`, `walletType`, `baseUrl`。下流は `setPaymentSessionEnricher()`（`sessionEnricher.ts`、`enrichers/` に副作用 import で登録、1 つだけ）で `buyerAddress` 等を足せる。

---

## 3. redirect 型の追加手順

1. **実装**: `payment/<name>/<name>Provider.ts` に `PaymentProvider` を実装し、`payment/<name>/index.ts` から `export`（任意で `errorMapping.ts` に プロバイダのエラー → `PAYMENT_ERROR_CODES` の変換）
   - `createSession`: `getProviderApiMethodId("<name>", params.paymentMethod)` で API 固有 ID に変換。`getProviderApiMethodId` は mapping が無いと元の ID をそのまま返すので、**`paymentConfig.providers.<name>.methodMapping?.[params.paymentMethod]` が無ければ自分で throw する**（誤ルートの fail-fast）
   - `verifyWebhook`: 成功 → `{ success: true, status: "completed", paidAmount, ... }` / 確定失敗 → `{ success: false, status: "failed", errorCode }` / それ以外（AUTHORIZED, PROCESSING 等）→ `{ success: false, status: "pending" }`
2. **ファクトリ登録**（`payment/index.ts`）: `PaymentProviderName` union に追加 + `getPaymentProvider` の switch に case を追加
3. **config**（`src/config/app/payment.config.ts`）
   - `providers.<name>`: `enabled`、`methodMapping`（担当する `paymentMethods[i].id` → API 固有 ID）、必要なら `sessionExpiryMinutes`（`expires_at` の分数、既定 30）
   - `webhook.signatureHeaders.<name>`: 署名ヘッダー名（署名機構が無ければ `null` = 検証スキップ。その場合は `verifyWebhook` 内でプロバイダ API への二重確認を行う。Paidy の例）
   - `paymentMethods[]`: 担当メソッドの `provider: "<name>"`。`id` は全体で一意、1 メソッドを複数プロバイダで担当しない、`status="available"` なら `provider` 必須
   - Webhook URL の `?provider=` は `paymentConfig.providers` のキーで検証されるため、`providers` に無い名前は 400 になる
4. **照合キー**: Webhook が返す識別子が `createSession` の `sessionId` と違うなら、`deriveProviderOrderId` + `correlationKey: "order_id"` を宣言する。`findByWebhookIdentifier` は `payment_session_id` → UUID なら `id`（Square は `payment.note` に purchaseRequestId を入れてこれに当てる）→ `wrappers/purchaseHelpers.ts` の `webhookIdentifierResolvers[provider]` の順で引く。前 2 つで引けない形式だけリゾルバーを足す（Fincode が唯一の例）
5. **環境変数**: API キー・Webhook シークレット等を `.env.development` / `.env.production` に追加
6. **Webhook エンドポイント**: 新設不要。プロバイダのダッシュボードに `https://<origin>/api/webhook/payment?provider=<name>` を登録（route が `?provider` 検証 → 署名検証 → `handleWebhook`）

### チェックリスト

- [ ] `launchType` / `correlationKey` を宣言、独自 order ID なら `deriveProviderOrderId`
- [ ] `createSession` が同一 purchaseRequestId に冪等
- [ ] `methodMapping` 未定義メソッドを `createSession` で throw
- [ ] `verifyWebhook` が `status` 3 分岐と `paidAmount` を返す
- [ ] 署名検証は `timingSafeEqual`
- [ ] `getPaymentStatus`（照会 API がメソッド種別を要求するなら `paymentMethod` 引数を使う。Fincode の pay_type）
- [ ] `PaymentProviderName` + `getPaymentProvider` に登録
- [ ] `providers` / `webhook.signatureHeaders` / `paymentMethods` を設定
- [ ] Webhook を実際に受けて確認、Replay で冪等性確認（5 章）

---

## 4. client_sdk 型の追加差分

redirect 型の 1〜6 に加えて以下を行う。

**A. createSession** は外部 URL ではなく起動指示を返す。`sessionId` は外部 payment がまだ無いなら `purchaseRequestId` を流用してよい。`config` はそのままクライアントに渡るので **サーバー秘密（`sk_*`、Webhook secret 等）を入れない**（`publicKey`, `purchaseRequestId`, `amount`, 購入者情報など）。

**B. SDK ローダー**: `services/client/sdkLaunchers/<name>.ts` に `SdkLauncher` を実装し、`sdkLaunchers/index.ts` のレジストリに `<sdkName>: <name>SdkLauncher` を追加。

- `load()`: SDK スクリプトの動的読み込み（複数回呼ばれても 1 回だけ）
- `launch(config)` → `SdkLaunchOutcome`: `authorized`（`providerPaymentId`）| `rejected`（`reason`）| `closed`（ユーザーが閉じた）

**C. 確定 API ルート**: `src/app/api/wallet/purchase/[id]/<sdkName>/confirm/route.ts`。`clientSdkHandler` が `` `/api/wallet/purchase/${id}/${sdkName}/confirm` `` を組み立てるため、**ディレクトリ名は `sdkName` と一致させる**。`createApiRoute` + `access: "custom"` + ハンドラ内のセッション確認 + Zod でボディ検証をして確定サービスに委譲する（paidy / paypal の route が手本）。

**D. 確定サービス** `payment/<name>/confirm<Name>Payment.ts`:

1. purchase_request 取得 + 認可（`user_id` とプロバイダの一致）
2. ステータス分岐（completed は冪等 return、processing 以外は 400）
3. プロバイダ API で二重確認（amount / status）、必要なら capture
4. `payment_session_id` にプロバイダ側 payment ID を保存（Webhook 照合用）
5. `completePurchase`（楽観ロック 409 は alreadyCompleted として吸収）
6. `auditLogger.record({ action: "purchase_request.payment.confirmed", ... })`

動線:

```
購入ボタン → initiate → LaunchInstruction(client_sdk)
→ executePaymentLaunch → clientSdkHandler → sdkLaunchers[sdkName].load() / launch(config)
→ authorized → 確定 API を keepalive fetch（await しない）→ 即 successUrl（callback 画面）へ
   → サーバー: confirm<Name>Payment（二重確認 + capture + completePurchase）
→ callback 画面のポーリング → 完了画面
並行: /api/webhook/payment?provider=<name>（フォールバック）
```

追加チェック: `config` に秘密が無い / ローダー登録済み / 確定 route のパス = sdkName / プロバイダ API とコールバックで status 表記が混在するなら正規化ヘルパー（Paidy の `errorMapping.ts`）。

放置対策はコア側で済んでいる: 新規 initiate の直前に `expireStaleClientSdkSessions` が同一ユーザーの client_sdk processing を expired にし、後から confirm で capture される窓を閉じる。

---

## 5. ローカルで動かす

### コールバック URL のオリジン

`successUrl` / `cancelUrl` はブラウザで開いているドメインではなく `getAppBaseUrl()`（`src/lib/url/getAppBaseUrl.ts`）で組み立てる（Host Header Injection 対策）。優先順位:

1. `APP_BASE_URL`（明示上書き）
2. `VERCEL_ENV=preview` のとき `https://${VERCEL_URL}`
3. `businessConfig.url`（プレースホルダー `https://example.com` のままなら throw）

ローカルは 1 を使う。`pnpm env:init` が `.env.development` に `APP_BASE_URL=http://localhost:3000` を入れる（ポートは実際の dev サーバーに合わせる）。これでプロバイダからの戻り（success / cancel）はローカルに着地する。

### Webhook まで通す（ngrok 等）

Webhook はインターネット経由なので `localhost` には届かない。Webhook → 完了画面まで通すにはトンネルを使う。

1. `ngrok http 3000`
2. 払い出された URL を `.env.development` の `APP_BASE_URL=https://xxxxxxxx.ngrok-free.app` に設定（dev サーバー再起動）
3. プロバイダのテスト環境ダッシュボードに同じオリジンで Webhook を登録
   - Fincode テストモード: `https://xxxxxxxx.ngrok-free.app/api/webhook/payment?provider=fincode`
   - Square Sandbox: `https://xxxxxxxx.ngrok-free.app/api/webhook/payment?provider=square`
4. テスト決済 → ngrok の Web Interface（`http://127.0.0.1:4040`）で受信内容を確認。Replay で同じ Webhook を再送し、二重付与されないこと（冪等性）を確認

無料プランは再起動ごとに URL が変わるので、`.env.development` とダッシュボードの両方を更新する。

### dummy プロバイダ

UI フローと完了画面の確認だけなら、`paymentMethods` の対象メソッドの `provider` を一時的に `"dummy"` にする。`/demo/dummy-payment` の擬似決済ページに遷移し、外部通信も Webhook 登録も不要（`signatureHeaders.dummy = null`）。`NODE_ENV=production` では `getPaymentProvider` が throw する。確認後は `provider` を戻す（コミット前に確認）。

### 使い分け

- 通常の開発: dummy
- プロバイダ結合確認: ngrok + `APP_BASE_URL` + ダッシュボードの Webhook 登録
- 本番同等の実決済テスト: カスタムドメイン付き staging（ngrok URL の同期が要らない）

### よくある失敗

- Webhook が届かない: トンネル起動・ダッシュボードの URL（`?provider=` 含む）・購読イベントを確認
- 401: 署名シークレットの環境変数、`signatureHeaders` のヘッダー名
- 400 `invalid_provider`: `?provider=` が `paymentConfig.providers` のキーに無い
- セッションが見つからない（200 で無視される）: `payment_session_id` / `provider_order_id` が保存されているか、`correlationKey` とリゾルバー
- PENDING で失敗扱いになる: 未確定ステータスを `status: "pending"` で返していない
- 金額不一致で failed: `paidAmount` がプロバイダの実課金額（割引後の `payment_amount`）を返しているか

---

## 6. 本番前の確認

- `paymentConfig.debugLog = false`（true だと PII を含むペイロード全量をログ出力）
- dummy を担当にしたメソッドが残っていない
- 各プロバイダの本番ダッシュボードに `https://<本番ドメイン>/api/webhook/payment?provider=<name>` を登録
