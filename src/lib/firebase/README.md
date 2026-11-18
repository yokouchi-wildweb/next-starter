# `src/lib/firebase`

## Overview

Firebase SDK のクライアント・サーバーの初期化と、各種のユーティリティ。

- client(`client/`): 初期化 `app.ts`(`app`・`auth`・`fstore`)・Analytics `analytics.ts`・メールのリンクと確認コードの処理
- server(`server/`): Admin SDK の初期化 `app.ts`・Firebase Auth のユーザー操作 `authAdmin.ts`
- エラー: `errors.ts`(`FirebaseNotConfiguredError` など)
- ファイル: [src/lib/storage](../storage/README.md)(Firebase Storage のクライアント SDK の経路は無い。リポ直下の `storage.rules` は全拒否)
- 使う時・直す時の決まりは札 .claude/rules/items/lib/firebase.md にある。この README は使い方と仕組み

## Usage

### Firebase Analytics を使う

#### セットアップ

##### 1. Firebase コンソールで Analytics を有効化

1. [Firebase コンソール](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左メニューの「Analytics」をクリック
4. 「Analytics を有効にする」をクリック
5. Google Analytics アカウントを選択または新規作成
6. 有効化完了後、プロジェクト設定 > 全般 > 「マイアプリ」から **Measurement ID**（`G-XXXXXXXXXX` 形式）を取得

##### 2. 環境変数を設定

env ファイル(`.env.development`、本番は `.env.production`)に Measurement ID を追加します。

```bash
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**フォーク先での利用**: この値を設定しなければ Analytics は自動的に無効化されます（エラーは発生しません）。

##### 3. 送信を有効にし、同意の扱いを決める

Measurement ID を入れただけでは何も送りません。analyticsConsent の上書き `src/config/lib/analyticsConsent.config.ts` に `enabled: true` を書いて有効にします（門の仕様は [src/lib/analyticsConsent/README.md](../analyticsConsent/README.md)）。

- `enabled: true` + `consent: "required"`（既定）: 同意バナー / CMP が `setAnalyticsConsent("granted")` を呼ぶまで、初期化（gtag の読み込み）も page_view も trackEvent もしない
- `enabled: true` + `consent: "notRequired"`: 同意を待たずに送る（同意の取得を求めない運用）

##### 4. 動作確認

開発サーバーを起動し、Firebase コンソールの「Analytics > DebugView」でイベントが送信されていることを確認します。

```bash
pnpm dev
```

DebugView を有効にするには、ブラウザの開発者ツールで以下を実行します：

```js
localStorage.setItem('debug_mode', 'true');
```

#### 使い方

##### ページビューの自動トラッキング

`src/app/layout.tsx` に `<FirebaseAnalytics />` コンポーネントが配置されており、送ってよいとき（上の 3.）はルート遷移時に自動で `page_view` イベントが送信されます。同意が後から出たときは、その時点のページの `page_view` を 1 回送ります。`page_view` を送るのはこのコンポーネントだけで、初期化は `send_page_view: false`（gtag が初期化のときに自分で送る page_view を止める。止めないと最初のページが 2 回数えられる）。GA4 のプロパティの拡張計測「ブラウザの履歴イベントに基づくページの変更」が有効だと、遷移ごとに gtag も送る(page_view が 2 回数えられる)

```tsx
// src/app/layout.tsx（設定済み）
<Suspense fallback={null}>
  <FirebaseAnalytics />
</Suspense>
```

##### カスタムイベントの送信

任意のイベントを送信するには `trackEvent` 関数を使用します。

```tsx
import { trackEvent } from "@/lib/firebase/client/analytics";

// ボタンクリックをトラッキング
function handleClick() {
  trackEvent("button_click", {
    button_name: "signup",
    page: "/register",
  });
}

// 購入完了をトラッキング
function handlePurchase(amount: number) {
  trackEvent("purchase", {
    value: amount,
    currency: "JPY",
  });
}
```

##### ページビューの手動送信

特定のタイミングでページビューを送信したい場合は `trackPageView` を使用します。

```tsx
import { trackPageView } from "@/lib/firebase/client/analytics";

// モーダル内のコンテンツ表示をページビューとして記録
trackPageView("/modal/terms", "利用規約");
```

#### トラブルシューティング

##### イベントが送信されない

1. **環境変数の確認**: `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` が正しく設定されているか確認
2. **ブラウザ拡張機能**: 広告ブロッカーが Analytics をブロックしている可能性あり
3. **開発環境**: DebugView で確認（本番レポートには反映に時間がかかる）

##### SSR でエラーが発生する

Analytics はクライアントサイドでだけ動く。サーバーサイドで呼ぶとエラーになりうる。

```tsx
// NG: コンポーネントのトップレベルで呼び出す
const analytics = getFirebaseAnalytics(); // SSR時にエラーの可能性

// OK: useEffect内で呼び出す
useEffect(() => {
  trackPageView("/page");
}, []);
```

## API

### サーバー側ヘルパー(Admin SDK)

すべて Admin SDK ベースで、セキュリティルールを経由しない。
未設定時は下記すべてが `FirebaseNotConfiguredError("server")` になります（Internals「未設定モード」）。

`server/app.ts`（シングルトン・遅延初期化。サービスアカウントは `MY_SERVICE_ACCOUNT_KEY` の JSON、`projectId` / `storageBucket` はクライアントと同じ `NEXT_PUBLIC_FIREBASE_*` を使用）

- `getServerApp()` / `getServerAuth()` / `getServerFirestore()` / `getServerStorage()`

ファイルの保存・読み取り・削除は `src/lib/storage`（[Storage の使い方](../storage/README.md)）。`getServerStorage()` を使うのはその GCS 実装（`src/lib/storage/server/gcs.ts`）と `scripts/operations/storage/` だけ。Firebase Storage のクライアント SDK の経路はありません（リポ直下の `storage.rules` は全拒否）。

`server/authAdmin.ts`（Firebase Auth ユーザー操作。`uid` は users の providerUid）

- `getAuthUser(uid)` — 存在しなければ null
- `deleteAuthUser(uid)` / `disableAuthUser(uid)` / `enableAuthUser(uid)` / `revokeAuthTokens(uid)` — 対象ユーザーが既に存在しない場合は警告ログのみで正常終了

### クライアント側ヘルパー(Firebase Auth のメールのリンクと確認コード)

- `signInWithEmailLinkClient(email, link?)`(`client/signInWithEmailLinkClient.ts`): メールのリンクでサインインする。`link` を省くと今の URL
- `checkActionCodeValidity(oobCode)`(`client/checkActionCodeValidity.ts`): リンクの `oobCode` が有効か。期限切れ・無効なら `false`
- `getEmailChangeInfo(oobCode)` / `applyEmailChange(oobCode)`(`client/applyEmailChange.ts`): メールアドレスの変更のリンクの中身を読む(型 `EmailChangeInfo`、読めなければ null)/ 変更を確定する(成否を boolean)

### 誤り(`errors.ts`)

- `FirebaseNotConfiguredError(side)`: 未設定で触れたときの誤り。`side` = `"client"` | `"server"`
- `getFirebasePhoneAuthErrorMessage(error, fallbackMessage)`: 電話番号の認証の Firebase エラーを日本語の文言にする
- `hasFirebaseErrorCode(error, expectedCode)`: Firebase エラーのコードが `expectedCode` か(型ガード)

### Analytics

#### `getFirebaseAnalytics(): Analytics | null`

Firebase Analytics インスタンスを取得します。

- SSR 環境では `null` を返す
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` が未設定の場合は `null` を返す

```tsx
import { getFirebaseAnalytics } from "@/lib/firebase/client/analytics";

const analytics = getFirebaseAnalytics();
if (analytics) {
  // Analytics が有効な場合の処理
}
```

#### `trackPageView(pagePath: string, pageTitle?: string): void`

ページビューイベントを送信します。

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `pagePath` | `string` | ページのパス（例: `/about`） |
| `pageTitle` | `string?` | ページタイトル（省略時は `document.title`） |

#### `trackEvent(eventName: string, eventParams?: Record<string, unknown>): void`

カスタムイベントを送信します。

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `eventName` | `string` | イベント名（例: `button_click`） |
| `eventParams` | `Record<string, unknown>?` | イベントパラメータ |

#### 推奨イベント

Google Analytics 4 では以下の推奨イベントを使用すると、自動的にレポートが生成されます。

| イベント名 | 用途 | 主なパラメータ |
|-----------|------|----------------|
| `login` | ログイン | `method` |
| `sign_up` | 会員登録 | `method` |
| `purchase` | 購入完了 | `value`, `currency`, `items` |
| `add_to_cart` | カート追加 | `value`, `currency`, `items` |
| `search` | 検索実行 | `search_term` |
| `share` | コンテンツ共有 | `content_type`, `item_id` |

詳細: [GA4 推奨イベント](https://support.google.com/analytics/answer/9267735)

## Internals

### 未設定モード(Firebase なしで起動する)

`pnpm ops setup env` 直後は `NEXT_PUBLIC_FIREBASE_*` と `MY_SERVICE_ACCOUNT_KEY` が全て空です。この状態でも dev サーバーが起動し、トップページや `/api/health` が表示できることを手順書（`docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md` §3）で約束しています。そのための契約は次のとおりです。

| 層 | 判定関数 | 未設定時の挙動 |
|---|---|---|
| client (`client/app.ts`) | `isFirebaseClientConfigured()`（API key と projectId が非空） | `app` は従来どおり生成（空設定でも throw しない）。`auth` と `fstore` は初期化せず、触れた瞬間に `FirebaseNotConfiguredError("client")` を投げる Proxy になる（`import { auth, fstore }` の形状は不変。`collection(fstore, …)` などの SDK 関数も同じエラーで即座に止まる） |
| server (`server/app.ts`) | `isFirebaseServerConfigured()`（`MY_SERVICE_ACCOUNT_KEY` が非空） | `getServerApp / getServerAuth / getServerFirestore / getServerStorage` が `FirebaseNotConfiguredError("server")` を投げる（遅延初期化なので import だけでは失敗しない） |

- 判定は「未設定」だけ。設定済みで初期化・接続に失敗した場合は理由付きの Error / Firebase SDK のエラーになる（`DatabaseNotConfiguredError` と同じ線引き）
- 全ページに常時マウントされる経路は未設定でも落ちない: `useFirebaseAuthSync`（root layout の `AuthSessionClientProvider` から呼ばれる）と `getFirebaseAnalytics` は `isFirebaseClientConfigured()` でスキップする
- Firestore の `createCrudService`（`@/lib/crud/firestore`）は構築時に Firestore を解決せず、初回のメソッド呼び出し時に memoize する。これにより `serviceRegistry` 経由で全 API ルートが module 評価時に落ちることを防いでいます。
- それ以外の消費者（ログイン hooks、メール送信、Storage 等）はガード不要です。未設定で呼べば即座に `FirebaseNotConfiguredError` になり、ユーザーには通常のエラー表示として出ます。

未設定で動く範囲と、各機能に必要な設定の一覧は手順書の「機能別に必要なバックエンド」を参照してください。

## Related

- Storage: [src/lib/storage/README.md](../storage/README.md)
- 送信の門: [src/lib/analyticsConsent/README.md](../analyticsConsent/README.md)
- Firestore の読み書き: `src/lib/firestore/README.md`
