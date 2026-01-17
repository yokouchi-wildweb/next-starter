# transitionGuard

ページ遷移のガード機能を提供するライブラリ。
サインアップや購入手続きなどの一連のフローで、離脱したら最初からやり直させるユースケースに対応。

## 概要

- 消費型トークンによるページ遷移の検証
- クライアントサイドのUXガード（技術者によるバイパスは可能）
- sessionStorageを使用（タブ単位、リロードで消える）

## 基本的な使い方

### 遷移元: トークン発行 + ナビゲーション

```tsx
import { useGuardedNavigation } from "@/lib/transitionGuard";

function SignupForm() {
  const { guardedPush } = useGuardedNavigation();

  const onSubmit = async (data) => {
    await register(data);
    guardedPush("/signup/complete");  // トークン発行 + 遷移
  };

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

### 遷移先: ガード設定

```tsx
"use client";

import { useTransitionGuard } from "@/lib/transitionGuard";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";

export default function SignupCompletePage() {
  const { isChecking } = useTransitionGuard({
    allowedReferers: ["/signup/register"],
    onFail: { action: "redirect", path: "/signup" }
  });

  if (isChecking) return <ScreenLoader />;

  return <div>登録完了しました</div>;
}
```

## ガード設定オプション

| オプション | 型 | 説明 |
|------------|------|------|
| `allowedReferers` | `string[]` | 許可する遷移元URL（補助的、optional） |
| `requireToken` | `boolean` | トークン必須か（デフォルト: true） |
| `tokenKey` | `string` | 特定トークンのキー（指定時はkey一致も検証） |
| `onFail` | `GuardFailAction` | ガード失敗時の挙動 |

### onFail アクション

| アクション | 説明 |
|------------|------|
| `{ action: "redirect", path: "/path" }` | 指定パスにリダイレクト |
| `{ action: "notFound" }` | 404ページを表示 |
| `{ action: "error", message?: "..." }` | エラーをスロー |
| `{ action: "none" }` | 何もしない（条件付き表示用） |

## ユースケース別サンプル

### トークンのみでガード（Refererチェックなし）

```tsx
useTransitionGuard({
  onFail: { action: "redirect", path: "/signup" }
});
```

### 特定トークンでガード（厳密な検証）

```tsx
// 遷移元
guardedPush("/gacha/result", { key: `gacha:roll:${sessionId}` });

// 遷移先
useTransitionGuard({
  tokenKey: `gacha:roll:${sessionId}`,
  onFail: { action: "notFound" }
});
```

### 条件付き表示（失敗しても何もしない）

```tsx
"use client";

export default function PurchaseCompletePage() {
  const { isChecking, isValidTransition } = useTransitionGuard({
    allowedReferers: ["/purchase/confirm"],
    onFail: { action: "none" }
  });

  if (isChecking) return <ScreenLoader />;

  return (
    <div>
      {isValidTransition && <SuccessBanner message="ご購入ありがとうございます！" />}
      <OrderDetails />
    </div>
  );
}
```

## API

### useGuardedNavigation

トークン発行付きのナビゲーション関数を提供するフック。

```tsx
const { guardedPush, guardedReplace } = useGuardedNavigation();

// 通常の使用
guardedPush("/path");

// 特定トークン付き
guardedPush("/path", { key: "domain:action:id" });

// カスタムTTL（ミリ秒）
guardedPush("/path", { ttl: 10 * 60 * 1000 }); // 10分
```

### useTransitionGuard

ページマウント時にトークン検証を行うフック。

```tsx
const { status, isChecking, isValidTransition } = useTransitionGuard(config);
```

| 戻り値 | 型 | 説明 |
|--------|------|------|
| `status` | `"checking" \| "passed" \| "failed"` | ガードステータス |
| `isChecking` | `boolean` | チェック中かどうか |
| `isValidTransition` | `boolean` | 正規の遷移かどうか |

## 注意事項

- クライアントサイドのみの検証のため、セキュリティガードではなくUXガードとして使用
- 遷移先ページは `"use client"` が必須
- トークンの有効期限はデフォルト5分（`DEFAULT_TOKEN_TTL_MS`）
- sessionStorageを使用するため、タブ間で共有されない
