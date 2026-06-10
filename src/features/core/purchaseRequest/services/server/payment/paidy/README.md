# Paidy 決済プロバイダ

Paidy（あと払い／BNPL）の決済プロバイダ実装。
**client_sdk 起動方式** — Paidy 公式 JS SDK (`paidy.js`) によるモーダル決済を採用する。
サーバーがリダイレクト URL を返す redirect 型プロバイダ（Stripe / Fincode / Square 等）とは
動線が異なるため、本ドキュメントで差分を明示する。

## ファイル構成

```
paidy/
├── README.md                 # このファイル
├── paidyProvider.ts          # メインのプロバイダ実装（PaymentProvider インターフェース）
├── confirmPaidyPayment.ts    # 決済完了確定サービス（SDK 完了後の確定 API から呼ばれる）
├── errorMapping.ts           # ステータス定数 + 正規化ヘルパー
└── index.ts                  # 公開 API の re-export
```

関連ファイル（このディレクトリ外）:

```
src/features/core/purchaseRequest/services/client/
├── launchers/
│   ├── clientSdkHandler.ts   # client_sdk 型 LaunchInstruction のハンドラ
│   └── ...
└── sdkLaunchers/
    └── paidy.ts              # paidy.js の動的ロード + Paidy.configure / launch ラップ

src/app/api/wallet/purchase/[id]/paidy/confirm/
└── route.ts                  # SDK 完了後の確定 API ルート
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `PAIDY_PUBLIC_KEY` | パブリック API キー（`pk_test_...` / `pk_live_...`）。クライアント (paidy.js) に渡される |
| `PAIDY_SECRET_KEY` | シークレット API キー（`sk_test_...` / `sk_live_...`）。サーバー側で Paidy API 呼び出しに使用 |

Paidy はテスト / 本番で**同一エンドポイント** (`https://api.paidy.com`) を使い、API キーの prefix
（`pk_test_*` / `pk_live_*` / `sk_test_*` / `sk_live_*`）で環境を切り替える。
test / live 切替は env の値を入れ替えるだけで完結する。

## プロバイダメソッド

### createSession

LaunchInstruction `{ type: "client_sdk", sdkName: "paidy", config: { ... } }` を返す。
**外部 Paidy API は呼ばない**（paidy.js がクライアント側で `/checkout` を叩くため）。

`config` に含めるフィールド:

| キー | 用途 |
|---|---|
| `publicKey` | クライアントが Paidy.configure に渡す pk_* |
| `purchaseRequestId` | 確定 API 呼び出し時に使用 |
| `amount` / `currency` | paidy.js の payload に直接渡す |
| `itemTitle` | `order.items[0].title`（initiate の `metadata.itemName` から取得、フォールバック `"購入"`） |
| `buyerName` | `buyer.name1`。`buyerAddress` の実氏名（姓+名）を優先、無ければ `userService.get` の表示名 → `"購入者"` フォールバック |
| `buyerEmail` / `buyerPhoneNumber` | `buyer.email` / `buyer.phone` |
| `buyerAddress` | `shipping_address`（line1/zip 等）の組み立て元。**休眠中の拡張ポイント**（PayPal/Square と同じ） |

サーバー秘密 (`sk_*`) は config に含めない（クライアントに渡るため厳禁）。

#### 購入者住所の事前入力（buyerAddress）

与信精度向上のため、`params.buyerAddress`（`setPaymentSessionEnricher` でダウンストリームが供給）を
Paidy の `shipping_address` に渡す。このテンプレート自体は住所を保持しないため既定では未供給。

- マッピング（**line1/line2 は Square 等と逆**。Paidy は line1=建物名・部屋番号 / line2=番地）:
  `addressLine2(建物名)→line1` / `addressLine1(番地)→line2` / `locality→city` /
  `administrativeArea→state` / `postalCode→zip`。
  **`country` は Paidy 公式 shipping_address に存在しないため送らない**（未知フィールドで 400 になる
  リスク回避。フィールドは line1/line2/city/state/zip のみ）。
- 付与条件: **`postalCode` と `addressLine1`（番地）が両方揃う時のみ**（公式要件「zip 必須 +
  他1フィールド以上」を満たす。番地は line2 として常に入る）。不完全だと Paidy が 400 を返し
  決済全体が失敗するため。
- `zip` は **NNN-NNNN 形式**に整形（ハイフン無し7桁 `/^\d{7}$/` の場合のみ NNN-NNNN 化）。
- `buyer.name1` も `buyerAddress.lastName + firstName`（実氏名）が供給されていればそれを優先する。

### verifyWebhook

Paidy Webhook ペイロードを検証して `PaymentResult` を返す。
**Paidy は HMAC 等の Webhook 署名検証機構を提供していない**ため、ペイロードを信頼せず必ず
`GET /payments/{id}` で Paidy API へ再問い合わせして金額・状態を二重確認する。

ステータス分岐（`status` フィールド値）:

| Webhook status | 処理 |
|---|---|
| `authorize_success` | 与信成功（capture 待ち）→ `status: "pending"` で返却（completePurchase はクライアント確定 API 経由で走る） |
| `capture_success` / `close_success` | capture 完了 → `status: "completed"`（`captured_amount === 0` の void close は failed 扱い） |
| `refund_success` | 返金完了 → 当面 `pending` で無視（将来実装時に拡張） |
| `update_success` | 金額更新等 → `pending` |

`event_type !== "payment"`（token 系イベント）は本テンプレートでは扱わないため `pending` で無視。

### verifyWebhookSignature

Paidy が署名機構を提供していないため**常に `true` を返す**。
偽 Webhook 対策は `verifyWebhook` 内の `GET /payments/{id}` 二重確認に集約している。
将来 Paidy が署名を追加した場合はここを実装し、`payment.config.ts` の
`webhook.signatureHeaders.paidy` にヘッダー名を設定すれば自動で有効化される。

### getPaymentStatus（ポーリング用）

`GET /payments/{paymentId}` を叩いて Paidy 側ステータスを取得する。
引数 `sessionId` には Paidy の `pay_xxx`（`provider_session_id` に確定 API で記録された値）が
渡される前提。

| Paidy status | 戻り値 status |
|---|---|
| `authorized` | `processing` |
| `closed` (captured_amount > 0) | `completed` |
| `closed` (captured_amount === 0) | `failed`（void close） |
| `rejected` | `failed` |
| その他 | `pending` |

### capturePayment（プロバイダ内部メソッド）

`POST /payments/{id}/captures` を叩いて与信を確定（capture）させる。
`confirmPaidyPayment` から AUTHORIZED 状態の payment に対して呼ばれる。
冪等性は Paidy の `Paidy-Idempotency-Key` ヘッダーで保証。

## confirmPaidyPayment（確定サービス）

`POST /api/wallet/purchase/[id]/paidy/confirm` から呼ばれる**確定処理本体**。
client_sdk 型の決済では Webhook を待たず、クライアントから能動的に呼ばれる。

処理フロー:

1. `purchase_request` を取得して認可（user_id 一致 + provider が `"paidy"` か検証）
2. ステータス確認（`completed` なら冪等 return、`processing` 以外は 400）
3. `paidyProvider.fetchPayment(providerPaymentId)` で Paidy API 二重確認（amount / status）
4. ステータス別:
   - `authorized` → `capturePayment` 実行
   - `closed` → 既に capture 済み（スキップして 5 へ）
   - `rejected` → `failPurchase` を呼んで 400
5. `payment_session_id` に Paidy の `payment_id` を保存（後着 Webhook の照合用）
6. `completePurchase` 呼び出し（楽観ロック 409 は alreadyCompleted として吸収）
7. `auditLogger.record({ action: "purchase_request.payment.confirmed", ... })`

## errorMapping.ts

| 定義 | 用途 |
|---|---|
| `PAIDY_ERROR_MAP` | Paidy エラーコード → 共通エラーコードのマッピング（最小限） |
| `PAIDY_WEBHOOK_EVENTS` | `authorize_success` / `capture_success` / `close_success` / `refund_success` / `update_success` |
| `PAIDY_PAYMENT_STATUS` | `authorized` / `pending` / `rejected` / `closed`（**全て小文字**） |
| `PAIDY_EVENT_TYPE` | `payment` / `token` |
| `normalizePaidyStatus()` | status 値を `.toLowerCase()` で正規化（後述の大文字小文字混在対応） |

## Webhook フロー

### イベント順序

1 件の決済で Paidy は **3 通の Webhook** を立て続けに送信する:

1. `authorize_success`（与信成功、capture 前）
2. `capture_success`（capture 完了）
3. `close_success`（close 完了）

各イベントは並行で確定 API（クライアント完了経路）と競合する可能性があるが、
`completePurchase` の楽観ロック（`WHERE status = 'processing'`）で片方しか成功しないため
冪等性は保たれる。

### status 値の大文字 / 小文字混在

- **paidy.js の `closed` コールバック**: 小文字（`"authorized"` / `"rejected"` / `"closed"`）
- **Paidy REST API のレスポンス**: 大文字（`"AUTHORIZED"` / `"CLOSED"` / `"REJECTED"`）

両方に対応するため `normalizePaidyStatus(status)` を経由して比較すること。
`PAIDY_PAYMENT_STATUS` は小文字で定義しているため、`normalizePaidyStatus()` を通せば一致する。

### セッション ID の照合

- `createSession` 時点では Paidy 側に payment は存在しないため、`sessionId = purchase_request.id` を流用
- paidy.js モーダル完了後、`pay_xxx` が発行される → 確定 API が `payment_session_id` に上書き保存
- 後着の Webhook が来た時点で `payment_session_id` に `pay_xxx` が入っているため、
  `findByWebhookIdentifier` で正しく purchase_request が引ける

## PII ログ制御

`paymentConfig.debugLog` が `true` の場合のみペイロード全体を出力する。
`false` の場合は `event_type` / `status` / `payment_id` の最小限のみ。
**本番環境では `false` 必須**（メアド・電話番号等の PII を含むため）。

---

## ダウンストリームでの有効化手順

ダウンストリームプロジェクトで Paidy 決済を本番運用するための手順。

### 1. Paidy 加盟店登録 + 審査完了

[Paidy 加盟店申込](https://merchant.paidy.com/jp/) を完了し、ダッシュボード
([new-merchant.paidy.com](https://new-merchant.paidy.com/)) にログインできる状態にする。
ホーム画面の「初期設定はお済みですか?」案内に従って初期設定を完了させる
（業種登録 / 商材情報 / 利用区分の確定）。

### 2. API キーの発行

ダッシュボード → API 設定 → テスト用 / 本番用 タブで:

1. パブリックキー（`pk_test_*` / `pk_live_*`）の「再発行」ボタン → 発行
2. シークレットキー（`sk_test_*` / `sk_live_*`）の「再発行」ボタン → 発行
   - **シークレットキーは発行時に一度しか全表示されない**。必ず即座にコピーして保管すること。
   - 紛失時は再発行が必要（旧キーは無効化される）。

### 3. 環境変数の設定

`.env.development` / Vercel 環境変数等に設定:

```env
# テスト用キー（開発・staging 環境）
PAIDY_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxx
PAIDY_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx

# 本番キー（本番デプロイのみ）
# PAIDY_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxx
# PAIDY_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx
```

### 4. Webhook URL の登録

Paidy ダッシュボード → API 設定 → テスト用 / 本番用 タブ → Webhooks セクション:

1. Webhook トグルを ON
2. Webhook URL に下記を設定:
   ```
   https://<your-domain>/api/webhook/payment?provider=paidy
   ```
3. 「設定」ボタンで保存

Webhook 動作確認は同セクションの「Authorize Success」「Capture Success」等のテスト送信ボタンで可能。
テストペイロードの `payment_id` は仮値（`pay_0000000000000001`）のため Paidy API 二重確認で 404 が返るが、
これは設計通り（ルートが 200 を返し、`[Paidy] Webhook received` がログに出れば疎通 OK）。

### 5. payment.config.ts の状態確認

`src/config/app/payment.config.ts` で:

```ts
providers: {
  paidy: { enabled: true },  // ← true であること
},
paymentMethods: [
  {
    id: "paidy",
    status: "available",  // ← "available" であること
    provider: "paidy",
    // ...
  },
],
```

これらは upstream 既定値で有効。コイン以外の決済シナリオで使わない場合は `status: "disabled"` に変更可。

### 6. Vercel Deployment Protection の解除（本番のみ）

production デプロイで Webhook を受け取るには Vercel Authentication を OFF にする必要がある。
Vercel Dashboard → Settings → Deployment Protection → Vercel Authentication を Disabled に。
これは BtoC サービスの本番運用では標準的な設定（アプリ層の認証は Firebase Auth + 各種 authGuard で
別途守られている）。

---

## 注意点

### redirect 型 provider との設計差分

| 観点 | redirect 型（Stripe / Fincode 等） | **client_sdk 型（Paidy）** |
|---|---|---|
| createSession の戻り値 | 外部 provider の URL | 自社内で生成する LaunchInstruction.client_sdk |
| ユーザー画面遷移 | provider のホスト型決済ページ | 同一ページ上のモーダル |
| 確定経路 | success_url 戻り + Webhook | クライアント確定 API + Webhook |
| Webhook 役割 | 主経路（確定処理は Webhook で実行） | 補助経路（確定 API が先行、Webhook は失敗時フォールバック） |

### フォールバック動作

クライアント確定 API が何らかの理由で発火しなかった場合、Webhook（`capture_success`）が
`completePurchase` を実行することで救済される。両者は `completePurchase` 内の楽観ロック
（`WHERE status = 'processing'`）で競合制御されるため、片方が 409 を受けても冪等。

ただし `payment_session_id` の保存はクライアント確定 API でのみ行われるため、**Webhook 単独で
救済される経路では `findByWebhookIdentifier` がペイロード内 `payment_id` で照合するロジックが必要**。
これは現状 webhookHandler が `paymentResult.sessionId` で `payment_session_id` を引く設計に依存しており、
Paidy では sessionId に `pay_xxx` を入れているため OK。
