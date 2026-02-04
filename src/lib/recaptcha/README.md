# reCAPTCHA ライブラリ

Google reCAPTCHA v3 / v2 ハイブリッドによるボット対策ライブラリ。

## 概要

- **v3**: スコアベースの自動判定（ユーザー操作不要）
- **v2**: チャレンジベースの手動認証（v3で中間スコアの場合のフォールバック）
- 環境変数未設定時は自動的に機能を無効化（エラーにならない）
- バッジは自動で非表示（規約テキストで代替）

## セットアップ

### 1. 環境変数の設定

```env
# v3: スコアベースの自動判定
NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY=your_v3_site_key_here
RECAPTCHA_V3_SECRET_KEY=your_v3_secret_key_here

# v2: チャレンジベースの手動認証（オプション）
NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY=your_v2_site_key_here
RECAPTCHA_V2_SECRET_KEY=your_v2_secret_key_here
```

キーは [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/create) から取得。
v3とv2は別々のサイトキーが必要（同じキーは使えない）。

### 2. Providerの設置（設定済み）

`src/app/layout.tsx` で `RecaptchaProvider` がルートに設置済み。
バッジは自動的に非表示になる（Google公式で許可された方法）。

## 使用方法

### クライアント側

```tsx
"use client";

import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { getRecaptchaToken, RecaptchaBadge } from "@/lib/recaptcha";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";

function MyForm() {
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleSubmit = async () => {
    // トークンを取得（未設定時はundefinedが返る）
    const recaptchaToken = await getRecaptchaToken(
      executeRecaptcha,
      RECAPTCHA_ACTIONS.REGISTER, // または独自のアクション名
    );

    // APIに送信
    await fetch("/api/endpoint", {
      headers: {
        "X-Recaptcha-Token": recaptchaToken ?? "",
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* フォームフィールド */}

      {/* 規約テキスト（バッジ非表示時は必須） */}
      <RecaptchaBadge />

      <button type="submit">送信</button>
    </form>
  );
}
```

### サーバー側（routeFactory使用）

```ts
import { createApiRoute } from "@/lib/routeFactory";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { APP_FEATURES } from "@/config/app/app-features.config";

export const POST = createApiRoute({
  recaptcha: {
    action: RECAPTCHA_ACTIONS.REGISTER,
    threshold: APP_FEATURES.auth.signup.recaptchaThreshold,
  },
  handler: async (req, ctx) => {
    // reCAPTCHA検証はrouteFactoryが自動で実行
    // 検証失敗時は403エラーが返される
  },
});
```

### サーバー側（手動検証）

```ts
import { verifyRecaptcha } from "@/lib/recaptcha/server";

const token = req.headers.get("X-Recaptcha-Token") ?? "";
const result = await verifyRecaptcha(token, "action_name", 0.5);

if (!result.valid) {
  // スコアが低い or 検証失敗
  console.log(result.error, result.score);
}
```

## 新しいアクションの追加

1. `src/lib/recaptcha/constants.ts` にアクション名を追加:

```ts
export const RECAPTCHA_ACTIONS = {
  SEND_EMAIL_LINK: "send_email_link",
  REGISTER: "register",
  MY_NEW_ACTION: "my_new_action", // 追加
} as const;
```

2. 閾値（threshold）は使用箇所の設定ファイルで管理する。

## エクスポート

### クライアント用 (`@/lib/recaptcha`)

| 名前 | 説明 |
|------|------|
| `getRecaptchaToken` | reCAPTCHA v3トークンを取得 |
| `RecaptchaBadge` | バッジ表示コンポーネント（設置したページで右下にバッジ表示） |
| `RecaptchaV2Challenge` | v2チャレンジモーダルコンポーネント |
| `useRecaptchaV2Challenge` | v2チャレンジ状態管理フック |
| `isV2ChallengeRequired` | エラーがv2チャレンジ要求かを判定 |

### サーバー用 (`@/lib/recaptcha/server`)

| 名前 | 説明 |
|------|------|
| `verifyRecaptcha` | v3トークンを検証 |
| `verifyRecaptchaV2` | v2トークンを検証 |
| `RecaptchaVerifyResult` | v3検証結果の型 |
| `RecaptchaV2VerifyResult` | v2検証結果の型 |

### 定数 (`@/lib/recaptcha/constants`)

| 名前 | 説明 |
|------|------|
| `RECAPTCHA_ACTIONS` | アクション名の定数 |
| `RECAPTCHA_V3_INTERNALS` | v3内部設定（通常は直接使用しない） |
| `RECAPTCHA_V2_INTERNALS` | v2内部設定（通常は直接使用しない） |

## v3/v2 ハイブリッド

v2を有効にすると、v3で中間スコアの場合にv2チャレンジを表示できる。

### 閾値設定（`app-features.config.ts`）

```ts
signup: {
  recaptchaThreshold: 0.5,    // v3通過閾値
  recaptchaV2Threshold: 0.3,  // v2チャレンジ閾値
}
```

### 判定フロー

```
スコア >= 0.5  → 通過
スコア 0.3〜0.5 → v2チャレンジ表示（HTTP 428）
スコア < 0.3   → ブロック（HTTP 403）
```

### クライアント側の実装例

```tsx
import {
  RecaptchaV2Challenge,
  useRecaptchaV2Challenge,
  isV2ChallengeRequired,
} from "@/lib/recaptcha";

function MyForm() {
  const {
    challengeState,
    handleV2ChallengeRequired,
    handleV2Verify,
    closeChallenge,
  } = useRecaptchaV2Challenge();

  const handleSubmit = async () => {
    try {
      await api.post("/endpoint", data, {
        headers: { "X-Recaptcha-Token": recaptchaToken },
      });
    } catch (error) {
      // v2チャレンジが必要な場合
      if (isV2ChallengeRequired(error)) {
        handleV2ChallengeRequired(error);
        return;
      }
      throw error;
    }
  };

  // v2認証成功後は recaptchaV2Token を使って再送信
  const handleV2Success = async (token: string) => {
    await api.post("/endpoint", data, {
      headers: { "X-Recaptcha-V2-Token": token },
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit}>...</form>
      {challengeState.siteKey && (
        <RecaptchaV2Challenge
          open={challengeState.isOpen}
          onClose={closeChallenge}
          onVerify={handleV2Success}
          siteKey={challengeState.siteKey}
        />
      )}
    </>
  );
}
```

## スコアについて

- 範囲: 0.0（bot）〜 1.0（人間）
- 推奨閾値: 0.5（Googleのデフォルト）
- テスト時: 0.99 に設定するとほぼ全てブロックされる

## 注意事項

- バッジを非表示にする場合、`RecaptchaBadge` で規約テキストを表示する必要がある（Google規約）
- 無料枠: 100,000リクエスト/月
- 環境変数が空または短すぎる（20文字未満）場合は自動で無効化

## 依存パッケージ

- `react-google-recaptcha-v3` - v3用Reactラッパー
- `react-google-recaptcha` - v2用Reactラッパー
