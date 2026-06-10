# PayPal 決済プロバイダ（client_sdk 起動方式）

PayPal を **直接連携**（中間プロバイダを介さない）で実装したもの。PayPal JS SDK（Smart
Payment Buttons）でページ内ボタンを描画し、承認後にサーバーで capture する `client_sdk` 型。
サーバーがリダイレクト URL を返す redirect 型（Stripe / Fincode / Square 等）とは動線が異なる。

> **ダウンストリーム担当者向け**: 本番運用の手順は
> [「ダウンストリームでの本番セットアップ手順」](#ダウンストリームでの本番セットアップ手順) と
> [「PayPal 管理画面の詰まりポイント / FAQ」](#paypal-管理画面の詰まりポイント--faq) を参照。

## ファイル構成

```
paypal/
├── README.md                 # このファイル
├── paypalProvider.ts         # メインのプロバイダ実装（PaymentProvider インターフェース）
├── payPalClient.ts           # OAuth トークン取得 + env 切替 + REST 共通 fetch ラッパ
├── confirmPayPalPayment.ts   # 決済完了確定サービス（SDK 完了後の確定 API から呼ばれる）
├── errorMapping.ts           # ステータス / Webhook イベント / エラーコードの定数
└── index.ts                  # 公開 API の re-export
```

関連ファイル（このディレクトリ外）:

```
src/features/core/purchaseRequest/services/client/
├── launchers/clientSdkHandler.ts   # client_sdk 型 LaunchInstruction のハンドラ
└── sdkLaunchers/paypal.ts          # PayPal JS SDK ロード + オーバーレイにボタン描画

src/app/api/wallet/purchase/[id]/paypal/confirm/route.ts  # SDK 完了後の確定 API ルート
src/app/api/webhook/payment/route.ts                       # 共通 Webhook 受け口（?provider=paypal）
```

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

## 環境変数

| 変数名 | 説明 | Vercel Sensitive |
|--------|------|:---:|
| `PAYPAL_ENV` | 実行環境。`sandbox`（開発・疎通） / `live`（本番）。**未設定時は安全側の sandbox** | 不要 |
| `PAYPAL_CLIENT_ID` | クライアント JS SDK に渡る公開 ID（PayPal 的に公開値） | 不要 |
| `PAYPAL_CLIENT_SECRET` | サーバー専用シークレット（Orders API / Webhook 検証） | **必須** |
| `PAYPAL_WEBHOOK_ID` | Webhook 署名検証に使う ID（資格情報ではないが ID） | 不要 |

- **`NEXT_PUBLIC_` は付けない**。`PAYPAL_CLIENT_ID` も `createSession` のレスポンス経由でクライアントに渡すため、env 名にプレフィックスは不要。
- **sandbox と live は API ホストが異なる**（`api-m.sandbox.paypal.com` / `api-m.paypal.com`）。`PAYPAL_ENV` で切り替わる。Paidy のような「キー prefix で切替」ではない点に注意。
- Vercel では **環境スコープを分ける**のが推奨: Production に live 値、Preview/Development に sandbox 値。こうすればプレビューはテスト、本番だけ実決済になる。

## 重要な仕様メモ

- **JPY はゼロ小数通貨**: `amount.value` は小数なしの整数文字列（"1000"）で送る。
- **order_id が照合キー**: PayPal は createSession 時点で order_id が確定するため、Paidy と違い `payment_session_id` を確定 API で追記更新する必要がない。Webhook 照合（`findByWebhookIdentifier` の payment_session_id 一致）が初期化時点で成立する。
- **Webhook 署名検証あり**: `payment.config.ts` の `webhook.signatureHeaders.paypal = "Paypal-Transmission-Sig"`。`verifyWebhookSignature` が verify-webhook-signature API でトランスミッション系ヘッダー + `PAYPAL_WEBHOOK_ID` + 生ペイロードを検証する。
- **冪等性**: Order 作成・capture とも `PayPal-Request-Id` ヘッダーを付与。capture が `ORDER_ALREADY_CAPTURED`（422）の場合は no-op として最新 Order を返す。
- **PII ログ制御**: `paymentConfig.debugLog` が `true` の時のみペイロード全体を出力。**本番は `false` 必須**（メアド・電話番号等を含むため）。

## プロバイダメソッド

| メソッド | 概要 |
|---|---|
| `createSession` | Orders v2 で intent=CAPTURE の Order を作成し `LaunchInstruction.client_sdk` を返す。`payer`（email/電話/氏名/住所）と `application_context.shipping_preference` を付与 |
| `verifyWebhook` | 署名検証通過後のペイロードを `PaymentResult` に変換。`order_id`（無ければ `custom_id`）で照合 |
| `verifyWebhookSignature` | `POST /v1/notifications/verify-webhook-signature` で検証。`verification_status === "SUCCESS"` のみ有効 |
| `getPaymentStatus` | `GET /v2/checkout/orders/{id}` で状態照会（Webhook 未着時のフォールバック） |
| `captureOrder` | `POST /v2/checkout/orders/{id}/capture`。確定サービスから呼ばれる |
| `fetchOrder` | `GET /v2/checkout/orders/{id}`。確定・照会で共有 |

## 購入者情報の事前入力（prefill）

`createSession` は、供給されている購入者情報を PayPal Order の `payer`（email / 電話 / 氏名 / 住所）
として載せる。**供給されている項目だけ**を載せ、何も無ければ `payer` 自体を付けない（後方互換）。

- `buyerEmail` / `buyerPhoneNumber` — **このテンプレートでも供給される**。`initiatePurchase` が
  ユーザーレコード（`user.email` / `user.phoneNumber`）から設定する。電話は E.164 から
  PayPal の `national_number`（先頭 `+` を除いた数字・最大 14 桁）へ変換し、範囲外なら電話のみ省く。
- `buyerAddress` — **休眠中の拡張ポイント**。アプリ（ダウンストリーム）が住所を保持している場合、
  `setPaymentSessionEnricher` で `params.buyerAddress` を供給すると自動的に PayPal へ渡る
  （Square と同じ拡張ポイント）。このテンプレート自体は住所を保持しないため、既定では未供給。

```ts
// ダウンストリーム側の登録例
setPaymentSessionEnricher(async ({ userId, baseParams }) => {
  const address = await addressService.getByUserId(userId); // ダウンストリームの住所取得
  return { ...baseParams, buyerAddress: address };
});
```

### 配送先住所セクションの非表示

PayPal の決済モーダルに出る配送先住所セクション（「請求先住所に配送」チェックボックス等）は、
Order の `application_context.shipping_preference` で制御する。

- **既定 `NO_SHIPPING`** — コイン購入等のデジタル財では配送先が不要なため非表示。
- 物販を扱うダウンストリームは `providerOptions.shippingPreference` で
  `GET_FROM_FILE`（PayPal 上の住所から選択）/ `SET_PROVIDED_ADDRESS`（渡した住所で固定）に上書き可能。

資金源（PayPal 残高 / カード）に依らず効くよう、`payment_source` 配下ではなく order レベルの
`application_context` に置いている。

**注意（カード請求先住所の prefill 限界）**: 標準 Buttons のゲストのデビット/クレジットカード
決済では、請求先住所フォームは PayPal ホスト型のため、`payer.address` を渡しても確実に
prefill されるとは限らない（PayPal 側 UI 依存）。カードの請求先住所まで確実に自動入力・制御
したい場合は **Advanced Card Fields（`paypal.CardFields`）** への移行が必要。本実装は
「アプリが持つ情報を渡せるだけ渡す」配線に留めている。

## confirmPayPalPayment（確定サービス）

`POST /api/wallet/purchase/[id]/paypal/confirm` から呼ばれる確定処理本体。client_sdk 型では
Webhook を待たず、クライアント（onApprove）から能動的に呼ばれる。

1. `purchase_request` を取得して認可（user_id 一致 + provider が `"paypal"` か検証 + order_id 一致）
2. ステータス確認（`completed` なら冪等 return、`processing` 以外は 400）
3. `fetchOrder` で金額 / 状態を再確認
4. ステータス別: `APPROVED` → `captureOrder` 実行 / `COMPLETED` → 既に capture 済みで skip / `VOIDED` → `failPurchase` で 400
5. `completePurchase` 呼び出し（楽観ロック 409 は alreadyCompleted として吸収）
6. `auditLogger.record({ action: "purchase_request.payment.confirmed", ... })`

## 受信 Webhook イベントの扱い

| event_type | 扱い |
| --- | --- |
| `PAYMENT.CAPTURE.COMPLETED` | completed（決済確定） |
| `PAYMENT.CAPTURE.DENIED` | failed（決済失敗） |
| `CHECKOUT.ORDER.APPROVED` | pending（capture 前） |
| `PAYMENT.CAPTURE.PENDING` | pending（保留） |
| `PAYMENT.CAPTURE.REFUNDED` | pending（返金ハンドリングは未実装） |

Webhook は補助経路。正常時はクライアント確定 API が先に完了させ、Webhook は確定 API が
発火しなかった場合の救済として `completePurchase` を実行する（楽観ロックで冪等）。

---

## ダウンストリームでの本番セットアップ手順

> コードの追加実装は不要。**Live の認証情報取得 → 環境変数差し替え → Webhook 登録** で本番化できる。
> Sandbox と Live は**完全に別管理**（キーも Webhook ID も別物）。まず Sandbox で疎通確認 → Live、の順を推奨。

### 1. PayPal ビジネスアカウント + 本番有効化

[PayPal ビジネスアカウント](https://www.paypal.com/jp/business) を作成し、本番決済が可能な状態
（本人確認 / 事業者情報の登録完了）にする。**Live の API 認証情報は、アカウントが本番決済可能に
なるまで発行・利用できない**ことがある。

### 2. アプリ作成 & Client ID / Secret の取得

[PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) にログイン。

1. 画面**左上の `Sandbox` / `Live` トグル**で対象環境を選ぶ（**ここが最重要。環境を間違えると別物のキーを取得してしまう**）。
2. **Apps & Credentials** → 既定アプリを開く、または **Create App** で作成。
3. アプリ詳細で取得:
   - **Client ID** → `PAYPAL_CLIENT_ID`
   - **Secret key 1**（目アイコン / Show で表示）→ `PAYPAL_CLIENT_SECRET`

### 3. 環境変数の設定

Vercel の環境変数（Production / Preview / Development）に設定:

```env
# Production（本番）
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=<Live の Client ID>
PAYPAL_CLIENT_SECRET=<Live の Secret>   # ← Vercel で Sensitive にする
PAYPAL_WEBHOOK_ID=<Live の Webhook ID>  # ← 手順 4 で取得

# Preview / Development（テスト）には sandbox 値を入れておくと安全
# PAYPAL_ENV=sandbox / Sandbox の Client ID・Secret・Webhook ID
```

env を変更したら **再デプロイ**して反映させる。

### 4. Webhook の登録 & Webhook ID の取得

対象環境（Live）で、アプリ詳細ページ下部の **Webhooks** セクション → **Add Webhook**。

1. **URL**（末尾の `?provider=paypal` を必ず付ける。無いと共通ルートが 400 を返す）:
   ```
   https://<本番ドメイン>/api/webhook/payment?provider=paypal
   ```
2. **イベント**を選択（巨大な折りたたみリストから探す。場所は下表）:

   | イベント | カテゴリ | リスト上の表記 |
   |---|---|---|
   | `CHECKOUT.ORDER.APPROVED` | Checkout | "Checkout order approved" |
   | `PAYMENT.CAPTURE.COMPLETED` | Payments & Payouts | "Payment capture completed" |
   | `PAYMENT.CAPTURE.DENIED` | Payments & Payouts | "Payment capture denied" |

   （任意で `PAYMENT.CAPTURE.PENDING` / `PAYMENT.CAPTURE.REFUNDED` も追加可）
3. 保存後に表示される **Webhook ID** を `PAYPAL_WEBHOOK_ID` に設定。**必要なのは URL ではなく Webhook ID**。

### 5. payment.config.ts の状態確認

`src/config/app/payment.config.ts` で PayPal が有効か確認（upstream 既定で有効）:

```ts
providers: {
  paypal: { enabled: true },          // ← true
},
paymentMethods: [
  { id: "paypal", status: "available", provider: "paypal", /* ... */ },  // ← available
],
```

PayPal を使わないプロジェクトは `status: "disabled"` にすれば UI から消える。

### 6. Vercel Deployment Protection の解除（本番のみ）

production デプロイで Webhook（PayPal からの外部 POST）を受け取るには、Vercel の
**Settings → Deployment Protection → Vercel Authentication を Disabled** にする必要がある。
有効だと Webhook が認証ページで弾かれて届かない。アプリ層の認証は Firebase Auth + authGuard で
別途守られているため、これは BtoC 本番運用での標準設定（Paidy 等と同様）。

### 7. 本番疎通の最終確認

1. **少額の実決済を 1 件**行い、コイン付与まで確認 → 必要なら PayPal 側で返金。
2. Live Dashboard の **Event Logs / Webhooks** で `PAYMENT.CAPTURE.COMPLETED` の配信を確認。
3. アプリ側のログに `[PayPal] Webhook received` が出ているか確認。

---

## PayPal 管理画面の詰まりポイント / FAQ

ダッシュボードで実際に詰まりやすい点。

- **Sandbox / Live の取り違え**: 左上トグルの状態で、表示される Client ID・Secret・Webhook が
  全く別物になる。**Sandbox のキー / Webhook ID は Live では動かない（逆も同様）**。環境ごとに
  取得・登録し直すこと。
- **Client ID が複数行に折り返して表示される**: 見た目が改行されていても**1 つの連続した文字列**
  （途中にスペースは無い）。手でコピーすると改行を挟みやすいので**コピーボタンを使う**。
- **Secret は隠れている**: 「Secret key 1」の**目アイコン / Show** で表示。コピーボタンあり。
  `+ Add Second Key` で 2 本目を作れる（無停止ローテーション用）。Paidy と違い後から再表示可能。
- **Webhook イベントが探しにくい**: 登録 UI のイベント一覧は巨大なカテゴリ別折りたたみ。
  目的のイベントは手順 4 の表のカテゴリ（Checkout / Payments & Payouts）を展開して探す。
- **Webhook URL の `?provider=paypal` 忘れ**: 共通ルートは `?provider` で配信元を判定するため
  必須。付け忘れると 400 になり購入が確定しない。
- **Live のキーが出てこない / 決済が通らない**: アカウントが本番決済可能な状態（オンボーディング・
  審査完了）か確認。未完了だと Live が機能しないことがある。
- **Webhook が届かない**: ①URL が HTTPS の公開ドメインか（localhost は不可）、
  ②`?provider=paypal` が付いているか、③**Vercel Deployment Protection が OFF か**（手順 6）を確認。
- **Sandbox の支払いテスト**: 支払う側のテストアカウントは **Testing Tools → Sandbox accounts** の
  personal アカウント（`sb-...@personal.example.com`）でログインして決済する。Live では使えない。
- **通貨**: 本実装は JPY 固定（ゼロ小数）。アカウントが JPY 受領可能であること（日本アカウントは可）。

---

## 注意点

### redirect 型 provider との設計差分

| 観点 | redirect 型（Stripe / Fincode 等） | **client_sdk 型（PayPal / Paidy）** |
|---|---|---|
| createSession の戻り値 | 外部 provider の URL | 自社内で生成する LaunchInstruction.client_sdk |
| ユーザー画面遷移 | provider のホスト型決済ページ | 同一ページ上のオーバーレイ + PayPal ポップアップ |
| 確定経路 | success_url 戻り + Webhook | クライアント確定 API + Webhook |
| Webhook 役割 | 主経路 | 補助経路（確定 API が先行、Webhook は救済） |

### モーダルを閉じた後の再購入

client_sdk 型は `initiatePurchase` 側で再起動に対応済み（`launchType: "client_sdk"`）。ユーザーが
PayPal モーダルを閉じて再度購入ボタンを押すと、同一 `processing` リクエストのまま createSession を
やり直してモーダルを再展開する（Order は `PayPal-Request-Id` 冪等キーで再利用）。
