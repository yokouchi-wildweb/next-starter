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

- `initGoogleTag(options?): void` — 冪等。gtag.js loader を 1 回だけ注入し、存在する ID のみ `config()`。既存の `window.gtag` / `dataLayer`（Firebase 等）を再利用。`options.ignoreReferrerPaths?: RegExp[]` でリファラー無視パスを追加可能
- `<GoogleTag ignoreReferrerPaths? />` — `"use client"`。mount 時に `initGoogleTag()` を呼ぶ。root layout body に配置済み
- `useGoogleAdsConversion()` → `{ fire }` — named コンバージョンを発火するフック。env 解決・dedup・mount ガードを内包
- `trackGoogleAdsConversion({ sendTo, value?, currency?, transactionId? })` — 低レベル API（`sendTo` 空 or gtag 不在で no-op）
- `GOOGLE_ADS_CONVERSIONS` — env から解決した named send_to レジストリ（`signup` / `coinPurchase`）
- `isGoogleTagEnabled()` — GA4 もしくは Ads の ID が設定済みか

## 外部リダイレクト戻りのリファラー無視（ignore_referrer）

リダイレクト型決済（Stripe / fincode / Square）や Firebase Auth の `signInWithRedirect`（authDomain 既定 = `{project}.firebaseapp.com`）から戻ると、リファラーが中間ドメインになり GA4 がセッション参照元を上書きする（stripe.com は Google の参照元カテゴリで「ショッピングサイト」扱いのため **Organic Shopping** に振り分けられ、広告・検索等の本来の流入元が失われる。firebaseapp.com はソーシャルログインのたびに referral として記録される）。

対策として `initGoogleTag()` は以下のいずれかに該当する場合、GA4 の `config` に `ignore_referrer: true` を付与し、元の流入元セッションを維持する（env 設定不要で全プロジェクトに自動適用）:

1. **パス判定**: ランディング時のパスが `/wallet/{slug}/purchase/{callback|complete|failed}` に一致（リファラーが取れない環境でも決済戻りを拾うフォールバック）
2. **リファラードメイン判定**: `document.referrer` のドメインが denylist に一致（サブドメイン込み）。既定: `firebaseapp.com` / `stripe.com` / `fincode.jp` / `square.site` / `squareup.com` / `gmopg.jp`（fincode カード決済の 3DS 認証ページ）/ `paypal.com` / `access.line.me`（LINE ログイン認可画面。LINE トーク等からの本物の流入を消さないよう `line.me` 全体は無視しない）。認証戻りは任意のページに着地するためパスでは判定できず、こちらでカバーする

- downstream の追加は root layout で `<GoogleTag ignoreReferrerPaths={[/^\/your\/return\/path/]} ignoreReferrerDomains={["your-psp.example"]} />`
- GA4 管理画面の「除外する参照のリスト」（管理 → データストリーム → タグ設定を行う）に上記ドメインを登録する対処も併用可（二重設定は無害）。コード側対策はこの lib 経由のタグ計測にのみ効く（Firebase Analytics が先に page_view を送るケースや GTM 直貼りには効かない）ため、管理画面側も設定しておくのが堅い
- Firebase Auth のリファラー問題の根本対策は authDomain をアプリ自身のドメインにして `/__/auth/*` をプロキシする構成（Google 推奨・ITP 対策も兼ねる）。インフラ構成に依存するため downstream 判断
- 決済ページ滞在が 30 分を超えた場合のセッション分断はどちらの方法でも防げない（GA4 仕様）

## 発火ポイント（core）

- サインアップ完了 `app/(user)/(auth)/signup/complete/page.tsx`: `useTransitionGuard` の正当遷移時のみ `fire("signup")`
- コイン購入完了 `features/core/purchaseRequest/components/PurchaseComplete`: `status==="completed"` で `fire("coinPurchase", { value, currency:"JPY", transactionId })`

## 新しいコンバージョンの追加

1. env を 1 つ足す（例 `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_XXX`）
2. `GOOGLE_ADS_CONVERSIONS` にキーを 1 行追加
3. 発火サイトで `fire("xxx", ...)` を呼ぶ

レジストリに載せない一時的・downstream 固有のコンバージョンは、自前で env を読んで
`trackGoogleAdsConversion({ sendTo })` を直接呼べる（lib 改修不要のエスケープハッチ）。
