# Square 決済プロバイダ

Square Checkout API（Payment Links）を使用した決済プロバイダ実装。

## ファイル構成

```
square/
├── README.md           # このファイル
├── squareProvider.ts   # メインのプロバイダ実装
└── errorMapping.ts     # エラーコード・ステータスマッピング
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `SQUARE_ACCESS_TOKEN` | API アクセストークン |
| `SQUARE_LOCATION_ID` | ロケーションID |
| `SQUARE_SIGNATURE_KEY` | Webhook 署名検証キー |
| `SQUARE_NOTIFICATION_URL` | Webhook 通知URL |
| `SQUARE_ENVIRONMENT` | 環境（`sandbox` / `production`） |

## プロバイダメソッド

### createSession

Square Checkout API の Payment Links を使用してワンステップ決済リンクを作成する。

- `quick_pay` で決済リンクを生成
- `payment_note` に purchaseRequestId を保存（Webhook 照合用）
- `idempotency_key` に purchaseRequestId を使用（Square API 側の冪等性保証）
- 戻り値:
  - `sessionId` = `data.payment_link.id`（Payment Link ID）
  - `redirectUrl` = `data.payment_link.url`

#### 購入者情報の事前入力

`pre_populated_data` で購入者情報を事前入力できる:

- `buyerEmail` → `pre_populated_data.buyer_email`
- `buyerPhoneNumber` → `pre_populated_data.buyer_phone_number`
- `buyerAddress` → `pre_populated_data.buyer_address`（`firstName` → `first_name` 等のキー変換あり）

下流プロジェクトでは `sessionEnricher` を使って設定する。

### verifyWebhook

Webhook ペイロードを検証し、決済結果を返す。3分岐のステータス判定:

1. **COMPLETED / APPROVED** → `success: true, status: "completed"`
   - `paidAmount`: `payment.amount_money.amount`（金額照合用）
   - `transactionId`: `payment.id`
2. **CANCELED / FAILED** → `success: false, status: "failed"`
   - `card_details.status` からエラーコードをマッピング
3. **それ以外（PENDING 等）** → `success: false, status: "pending"`（スキップ対象）

`sessionId` は `payment.note || payment.order_id || ""` で解決される。

### verifyWebhookSignature

HMAC-SHA256 による Webhook 署名検証。

- `notificationUrl + body` を `signatureKey` で署名
- `crypto.timingSafeEqual` で定数時間比較（タイミング攻撃防止）

### getPaymentStatus（ポーリング用）

Payment Link → Order → Payment の3段階で決済ステータスを取得する。

1. Payment Link ID で `order_id` を取得
2. Order から tender の `payment_id` を取得
3. Payment のステータスを確認

ステータスマッピング:
- `COMPLETED` / `APPROVED` → `"completed"`
- `CANCELED` / `FAILED` → `"failed"`
- それ以外 → `"pending"`

## errorMapping.ts

### 定数・ユーティリティ

- `SQUARE_PAYMENT_STATUS`: `APPROVED`, `PENDING`, `COMPLETED`, `CANCELED`, `FAILED`
- `isSuccessPaymentStatus`: `COMPLETED` または `APPROVED` を判定
- `isFailurePaymentStatus`: `CANCELED` または `FAILED` を判定
- `SQUARE_ERROR_MAP`: カード詳細ステータス → アプリ内エラーコードのマッピング
- `extractPaymentMethod`: `source_type` → 支払い方法名の変換

## Webhook フロー

### イベント順序

Square は決済フローで複数の Webhook イベントを送信する:

1. `payment.created`（status: `PENDING` or `APPROVED`）
2. `payment.updated`（status: `COMPLETED`）

`PENDING` は `verifyWebhook` で `status: "pending"` として返され、`handleWebhook` でスキップされる。

### セッションID の照合

- `createSession` が返す `sessionId` = Payment Link ID
- `payment.note` に purchaseRequestId（UUID）を保存
- `verifyWebhook` は `payment.note` を `sessionId` として返す
- `findByWebhookIdentifier` は UUID フォールバックで `purchaseRequest.id` と照合

## PII ログ制御

- `paymentConfig.debugLog` が `true` の場合のみペイロード全体を出力
- `false` の場合は `purchaseRequestId`, `amount`, `type`, `paymentId` 等の最小限のみ
