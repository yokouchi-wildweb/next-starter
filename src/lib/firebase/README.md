# `src/lib/firebase`

このディレクトリは Firebase SDK のクライアント・サーバー初期化と、各種ユーティリティを提供します。

## ディレクトリ構成

```
src/lib/firebase/
├── client/
│   ├── app.ts              # クライアント側 Firebase 初期化
│   ├── analytics.ts        # Firebase Analytics ユーティリティ
│   ├── checkActionCodeValidity.ts
│   └── signInWithEmailLinkClient.ts
├── server/
│   ├── app.ts              # サーバー側 Admin SDK 初期化
│   └── storage.ts          # Storage 操作ヘルパー
├── errors.ts               # Firebase 関連エラー定義
└── README.md               # このファイル
```

---

## Firebase Analytics

Firebase Analytics を使ってページビューやカスタムイベントをトラッキングできます。

### セットアップ

#### 1. Firebase コンソールで Analytics を有効化

1. [Firebase コンソール](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左メニューの「Analytics」をクリック
4. 「Analytics を有効にする」をクリック
5. Google Analytics アカウントを選択または新規作成
6. 有効化完了後、プロジェクト設定 > 全般 > 「マイアプリ」から **Measurement ID**（`G-XXXXXXXXXX` 形式）を取得

#### 2. 環境変数を設定

`.env.local` に Measurement ID を追加します。

```bash
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**フォーク先での利用**: この値を設定しなければ Analytics は自動的に無効化されます（エラーは発生しません）。

#### 3. 動作確認

開発サーバーを起動し、Firebase コンソールの「Analytics > DebugView」でイベントが送信されていることを確認します。

```bash
npm run dev
```

DebugView を有効にするには、ブラウザの開発者ツールで以下を実行します：

```js
localStorage.setItem('debug_mode', 'true');
```

---

### 使い方

#### ページビューの自動トラッキング

`src/app/layout.tsx` に `<FirebaseAnalytics />` コンポーネントが配置されており、ルート遷移時に自動で `page_view` イベントが送信されます。追加の設定は不要です。

```tsx
// src/app/layout.tsx（設定済み）
<Suspense fallback={null}>
  <FirebaseAnalytics />
</Suspense>
```

#### カスタムイベントの送信

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

#### ページビューの手動送信

特定のタイミングでページビューを送信したい場合は `trackPageView` を使用します。

```tsx
import { trackPageView } from "@/lib/firebase/client/analytics";

// モーダル内のコンテンツ表示をページビューとして記録
trackPageView("/modal/terms", "利用規約");
```

---

### API リファレンス

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

---

### 推奨イベント

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

---

### トラブルシューティング

#### イベントが送信されない

1. **環境変数の確認**: `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` が正しく設定されているか確認
2. **ブラウザ拡張機能**: 広告ブロッカーが Analytics をブロックしている可能性あり
3. **開発環境**: DebugView で確認（本番レポートには反映に時間がかかる）

#### SSR でエラーが発生する

Analytics はクライアントサイドでのみ動作します。サーバーサイドで呼び出すとエラーになる可能性があるため、必ず `useEffect` 内や イベントハンドラ内で使用してください。

```tsx
// NG: コンポーネントのトップレベルで呼び出す
const analytics = getFirebaseAnalytics(); // SSR時にエラーの可能性

// OK: useEffect内で呼び出す
useEffect(() => {
  trackPageView("/page");
}, []);
```

---

## その他の Firebase 機能

Auth、Firestore、Storage については以下を参照してください。

- [Firebase 統合についての説明](../../../docs/how-to/initial-setup/firebase統合についての説明.md)
- [Storage の使い方](../storage/README.md)
