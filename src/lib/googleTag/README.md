# googleTag

## Overview

- Google tag (gtag.js) + Google Ads コンバージョン計測。すべて `NEXT_PUBLIC_*` env 駆動で、未設定なら完全 no-op
- `lib/clarity`(env-gated・null 返却・root layout マウント)と同じパターン
- Firebase Analytics と `window.gtag` / `dataLayer` を共存させる(既存があれば再利用)
- クライアント専用(SSR では何もしない)
- 二重計上防止: `transactionId` 指定時はその単位で dedup、未指定時は mount あたり 1 回(`useGoogleAdsConversion`)
- 決まりは `.claude/rules/items/lib/googleTag.md`

## Usage

env:

- `NEXT_PUBLIC_GOOGLE_TAG_ID`(例 `G-XXXXXXX`): 未設定なら gtag.js を読み込まない
- `NEXT_PUBLIC_GOOGLE_ADS_ID`(例 `AW-XXXXXXX`): 未設定なら Ads の `config()` をスキップ
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP`(例 `AW-XXXXXXX/label`): 未設定なら signup コンバージョン no-op
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_COIN_PURCHASE`(例 `AW-XXXXXXX/label`): 未設定なら coinPurchase コンバージョン no-op

発火ポイント(core):

- サインアップ完了 `features/core/auth/hooks/useSignupComplete`(/signup/complete の公開 hook): `useTransitionGuard` の正当遷移時のみ `fire("signup")`
- コイン購入完了 `features/core/purchaseRequest/components/PurchaseComplete`: `status==="completed"` で `fire("coinPurchase", { value, currency:"JPY", transactionId })`

リファラー無視の追加(downstream): root layout で `@/wiring/GoogleTag` の `<GoogleTag ignoreReferrerPaths={[/^\/your\/return\/path/]} ignoreReferrerDomains={["your-psp.example"]} />`

## API

- `initGoogleTag(options?): void` — 冪等。gtag.js loader を 1 回だけ注入し、存在する ID のみ `config()`。既存の `window.gtag` / `dataLayer`(Firebase 等)を再利用。`options`(`GoogleTagInitOptions`)= `channels?`(判別表)・`ignoreReferrerPaths?: RegExp[]`・`ignoreReferrerDomains?: string[]`(どちらも既定にマージ)
- `<GoogleTag channels? ignoreReferrerPaths? ignoreReferrerDomains? />` — `"use client"`。mount 時に `initGoogleTag()` を呼ぶ。root layout body に配置済み(判別表を結んだ `src/wiring/GoogleTag.tsx` 経由)
- `useGoogleAdsConversion()` → `{ fire }` — named コンバージョンを発火するフック。env 解決・dedup・mount ガードを内包
- `trackGoogleAdsConversion({ sendTo, value?, currency?, transactionId? })` — 低レベル API(`sendTo` 空 or gtag 不在で no-op)
- `GOOGLE_ADS_CONVERSIONS` — env から解決した named send_to レジストリ(`signup` / `coinPurchase`)
- `isGoogleTagEnabled()` — GA4 もしくは Ads の ID が設定済みか
- `resolveLinkCampaign(search, channels)` → `{ campaign_source, campaign_medium } | null` — 招待等の独自チャンネルの判定(UTM・クリック ID があれば null)。`initGoogleTag` が中で使い、userAcquisition のテストが同じ表で突き合わせる
- 判別表の型 `GoogleTagChannelDefinition` = `{ param, kind: "clickId" | "link", channel: { source, medium } | null }`

## Extension

新しいコンバージョンの追加:

1. env を 1 つ足す(例 `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_XXX`)
2. `GOOGLE_ADS_CONVERSIONS` にキーを 1 行追加
3. 発火サイトで `fire("xxx", ...)` を呼ぶ

レジストリに載せない一時的・downstream 固有のコンバージョンは、自前で env を読んで `trackGoogleAdsConversion({ sendTo })` を直接呼べる(lib 改修不要)。

## Internals

### 外部リダイレクト戻りのリファラー無視(ignore_referrer)

リダイレクト型決済(Stripe / fincode / Square)や Firebase Auth の `signInWithRedirect`(authDomain 既定 = `{project}.firebaseapp.com`)から戻ると、リファラーが中間ドメインになり GA4 がセッション参照元を上書きする(stripe.com は Google の参照元カテゴリで「ショッピングサイト」扱いのため Organic Shopping に振り分けられ、広告・検索等の本来の流入元が失われる。firebaseapp.com はソーシャルログインのたびに referral として記録される)。

対策として `initGoogleTag()` は以下のいずれかに該当する場合、GA4 の `config` に `ignore_referrer: true` を付与し、元の流入元セッションを維持する(env 設定不要で全プロジェクトに自動適用):

1. パス判定: ランディング時のパスが `/wallet/{slug}/purchase/{callback|complete|failed}` に一致(リファラーが取れない環境でも決済戻りを拾うフォールバック)
2. リファラードメイン判定: `document.referrer` のドメインが denylist に一致(サブドメイン込み)。既定: `firebaseapp.com` / `stripe.com` / `fincode.jp` / `square.site` / `squareup.com` / `gmopg.jp`(fincode カード決済の 3DS 認証ページ)/ `paypal.com` / `access.line.me`(LINE ログイン認可画面。LINE トーク等からの本物の流入を消さないよう `line.me` 全体は無視しない)。認証戻りは任意のページに着地するためパスでは判定できず、こちらでカバーする

- GA4 管理画面の「除外する参照のリスト」(管理 → データストリーム → タグ設定を行う)にも同じドメインを登録できる(二重設定は無害)。コード側対策はこの lib 経由のタグ計測にのみ効く(Firebase Analytics が先に page_view を送るケースや GTM 直貼りには効かない)
- Firebase Auth のリファラー問題の根本対策は authDomain をアプリ自身のドメインにして `/__/auth/*` をプロキシする構成(Google 推奨・ITP 対策も兼ねる)。インフラ構成に依存するため downstream 判断
- 決済ページ滞在が 30 分を超えた場合のセッション分断はどちらの方法でも防げない(GA4 仕様)

### 招待リンク流入の独自チャンネル分類(campaign_source/medium)

GA4 は utm_* / クリック ID しか流入元判定に使わず、招待リンク(`?invite=CODE`、userAcquisition/referral 参照)の独自パラメータは無視される。X 等でシェアされた招待リンクからの流入が「t.co / referral」や「(direct) / (none)」に分類されてしまうため、`initGoogleTag()` はランディング URL が invite のみ(utm_* もクリック ID も無い)の場合、GA4 config に `campaign_source` / `campaign_medium`(既定: `invite` / `invite`)と `ignore_referrer: true` を付与し、独自チャンネルとしてセッションを分類させる。

- 判別表は `initGoogleTag({ channels })` / `<GoogleTag channels={…} />` で受け取る。値のある `link` の行のうち表の先の行の channel を送り、`clickId` の行・UTM があれば何もしない。渡さなければ何も足さない
- root layout が描く `src/wiring/GoogleTag.tsx` は userAcquisition の公開の口 `getChannelDefinitions()` を結んだ版(流入経路の機能が閉じていれば空の表、紹介の機能が閉じていれば招待の行は出ない)
- 優先順位はサービス側 DB 解析(userAcquisition の `classifyVisit`、同じ表)と同一(UTM > クリック ID > invite)。utm 併記リンクでは何もしない(GA 本来の判定を尊重)
- GA 管理画面の設定は不要。チャンネルグループ表示で「invite」を独自チャンネルにまとめたい場合のみ、source=invite を条件にしたカスタムチャンネルグループを作成する(任意)
- GA4 のチャンネルグループルールは独自パラメータを条件にできないため、GA 側設定だけではこの分類は実現できない(このコード側対応が唯一の自動化手段。ignore_referrer と同じく、この lib 経由のタグ計測にのみ効く)
