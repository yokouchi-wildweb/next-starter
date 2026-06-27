# googleTag

Google tag (gtag.js) + Google Ads コンバージョン計測。**すべて `NEXT_PUBLIC_*` env 駆動**で、未設定なら完全 no-op。`lib/clarity`（env-gated・null 返却・root layout マウント）と同じパターン。

## 設計方針

- env 未設定サイトは完全 no-op（ID・ラベルはソースに置かず env のみ）
- Firebase Analytics と `window.gtag` / `dataLayer` を共存（既存があれば再利用し**上書きしない**）
- クライアント専用（SSR では何もしない）
- 二重計上防止: `transaction_id` 単位の dedup ＋ mount あたり 1 回ガード（`useGoogleAdsConversion`）

## env

| 変数 | 例 | 未設定時 |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_TAG_ID` | `G-XXXXXXX` | gtag.js を読み込まない |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-XXXXXXX` | Ads の `config()` をスキップ |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP` | `AW-XXXXXXX/label` | signup コンバージョン no-op |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_COIN_PURCHASE` | `AW-XXXXXXX/label` | coinPurchase コンバージョン no-op |

## API

- `initGoogleTag(): void` — 冪等。gtag.js loader を 1 回だけ注入し、存在する ID のみ `config()`。既存の `window.gtag` / `dataLayer`（Firebase 等）を再利用
- `<GoogleTag />` — `"use client"`。mount 時に `initGoogleTag()` を呼ぶ。root layout body に配置済み
- `useGoogleAdsConversion()` → `{ fire }` — named コンバージョンを発火するフック。env 解決・dedup・mount ガードを内包
- `trackGoogleAdsConversion({ sendTo, value?, currency?, transactionId? })` — 低レベル API（`sendTo` 空 or gtag 不在で no-op）
- `GOOGLE_ADS_CONVERSIONS` — env から解決した named send_to レジストリ（`signup` / `coinPurchase`）
- `isGoogleTagEnabled()` — GA4 もしくは Ads の ID が設定済みか

## 発火ポイント（core）

- サインアップ完了 `app/(user)/(auth)/signup/complete/page.tsx`: `useTransitionGuard` の正当遷移時のみ `fire("signup")`
- コイン購入完了 `features/core/purchaseRequest/components/PurchaseComplete`: `status==="completed"` で `fire("coinPurchase", { value, currency:"JPY", transactionId })`

## 新しいコンバージョンの追加

1. env を 1 つ足す（例 `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_XXX`）
2. `GOOGLE_ADS_CONVERSIONS` にキーを 1 行追加
3. 発火サイトで `fire("xxx", ...)` を呼ぶ

レジストリに載せない一時的・downstream 固有のコンバージョンは、自前で env を読んで
`trackGoogleAdsConversion({ sendTo })` を直接呼べる（lib 改修不要のエスケープハッチ）。
