# PayPal 決済プロバイダ（client_sdk 起動方式）

PayPal を **直接連携**（中間プロバイダを介さない）で実装したもの。PayPal JS SDK（Smart
Payment Buttons）でページ内ボタンを描画し、承認後にサーバーで capture する `client_sdk` 型。

## 全体フロー

```
ユーザーが「PayPal」を選択 → 購入ボタン
  → initiatePurchase
    → paypalProvider.createSession
        - Orders v2 API で intent=CAPTURE の Order を作成（custom_id = purchaseRequestId）
        - sessionId = order.id を返す → initiatePurchase が payment_session_id に保存
        - LaunchInstruction { type: "client_sdk", sdkName: "paypal", config: { clientId, env, orderId, ... } }
  → クライアント sdkLaunchers["paypal"]
        - JS SDK を clientId で読み込み、オーバーレイに PayPal ボタンを描画
        - createOrder は config.orderId をそのまま返す
        - onApprove(data.orderID) → SdkLaunchOutcome { status: "authorized", providerPaymentId: orderID }
  → clientSdkHandler
        - 確定 API /api/wallet/purchase/[id]/paypal/confirm を keepalive fetch で発火
        - 即 successUrl（callback 画面）へ遷移、ポーリングで status を監視
  → confirmPayPalPayment
        - GET order で金額/状態を再確認 → APPROVED なら capture → completePurchase → 監査ログ
  → （補助）Webhook /api/webhook/payment?provider=paypal
        - 署名検証（verify-webhook-signature API）→ PAYMENT.CAPTURE.COMPLETED で救済確定
```

## 重要な仕様メモ

- **環境切替**: sandbox と live で **API ホストが異なる**（api-m.sandbox.paypal.com /
  api-m.paypal.com）。`PAYPAL_ENV`（sandbox / live）で切り替える。未設定時は安全側の
  sandbox にフォールバック。
- **JPY はゼロ小数通貨**: `amount.value` は小数なしの整数文字列（"1000"）で送る。
- **order_id が照合キー**: PayPal は createSession 時点で order_id が確定するため、
  Paidy と違い `payment_session_id` を確定 API で追記更新する必要がない。Webhook 照合
  （`findByWebhookIdentifier` の payment_session_id 一致）が初期化時点で成立する。
- **Webhook 署名検証あり**: `payment.config.ts` の `webhook.signatureHeaders.paypal` を
  `"Paypal-Transmission-Sig"` に設定。`verifyWebhookSignature` が verify-webhook-signature
  API でトランスミッション系ヘッダー + webhook_id + 生ペイロードを検証する。
- **冪等性**: Order 作成・capture とも `PayPal-Request-Id` ヘッダーを付与。capture が
  `ORDER_ALREADY_CAPTURED`（422）の場合は no-op として最新 Order を返す。

## セットアップ（管理画面）

1. https://developer.paypal.com/dashboard/ でアプリを作成（Sandbox / Live それぞれ）。
   - **Client ID** → `PAYPAL_CLIENT_ID`
   - **Secret** → `PAYPAL_CLIENT_SECRET`
2. Webhook を登録。
   - URL: `https://<オリジン>/api/webhook/payment?provider=paypal`
   - イベント: `PAYMENT.CAPTURE.COMPLETED` / `PAYMENT.CAPTURE.DENIED` /
     `CHECKOUT.ORDER.APPROVED`（必要に応じて `PAYMENT.CAPTURE.PENDING` /
     `PAYMENT.CAPTURE.REFUNDED`）
   - 発行された **Webhook ID** → `PAYPAL_WEBHOOK_ID`
3. `PAYPAL_ENV` を `sandbox` または `live` に設定。

## 環境変数

```env
PAYPAL_CLIENT_ID=...      # クライアント JS SDK に渡る公開 ID
PAYPAL_CLIENT_SECRET=...  # サーバー専用シークレット
PAYPAL_WEBHOOK_ID=...     # Webhook 署名検証用
PAYPAL_ENV=sandbox        # sandbox | live
```

## 受信 Webhook イベントの扱い

| event_type | 扱い |
| --- | --- |
| PAYMENT.CAPTURE.COMPLETED | completed（決済確定） |
| PAYMENT.CAPTURE.DENIED | failed（決済失敗） |
| CHECKOUT.ORDER.APPROVED | pending（capture 前） |
| PAYMENT.CAPTURE.PENDING | pending（保留） |
| PAYMENT.CAPTURE.REFUNDED | pending（返金ハンドリングは未実装） |
