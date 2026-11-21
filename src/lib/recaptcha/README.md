# reCAPTCHA ライブラリ

## Overview

Google reCAPTCHA v3 / v2 ハイブリッドによるボット対策ライブラリ(閉じた lib: 入口 `@/lib/recaptcha` = client の部品・フック・トークン・アクション名・サイトキー・設定の型、`@/lib/recaptcha/server` = 検証・版ごとの設定(シークレット)・デバッグの設定。キーは上書き `src/config/lib/recaptcha.config.ts` から受け、lib の中では env を読まない)。

- **v3**: スコアベースの自動判定（ユーザー操作不要）
- **v2**: チャレンジベースの手動認証（v3で中間スコアの場合のフォールバック）
- 環境変数未設定時は自動的に機能を無効化（エラーにならない）
- バッジは自動で非表示（規約テキストで代替）

## Usage

### セットアップ

#### 1. 環境変数の設定

```env
# v3: スコアベースの自動判定
NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY=your_v3_site_key_here
RECAPTCHA_V3_SECRET_KEY=your_v3_secret_key_here

# v2: チャレンジベースの手動認証（オプション）
NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY=your_v2_site_key_here
RECAPTCHA_V2_SECRET_KEY=your_v2_secret_key_here
```

上流の上書き `src/config/lib/recaptcha.config.ts` がこの env の名前を読む(サイトキーは `process.env.NEXT_PUBLIC_*` の字面で client に埋め込まれ、シークレットは関数で `./server` の中で使う時に読む)。別の env の名前で読みたい fork は上書きの右辺を変える。

キーは [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/create) から取得。
v3 と v2 は別々のサイトキー(同じキーは使えない)。

#### 2. Providerの設置（設定済み）

`RecaptchaProvider`(この lib の入口 `@/lib/recaptcha` から出す)は `src/wiring/AppProviders.tsx` がアプリ全体に設置済み(root layout の AppProviders の中)。
バッジは自動的に非表示になる（Google公式で許可された方法）。

### クライアント側

```tsx
"use client";

import { Button } from "@/components/Button/Button";
import { getRecaptchaToken, RECAPTCHA_ACTIONS, RecaptchaBadge, useRecaptcha } from "@/lib/recaptcha";

function MyForm() {
  // reCAPTCHA が無効(env 未設定)でも Provider が無くても落ちない(executeRecaptcha は undefined)
  const { executeRecaptcha } = useRecaptcha();

  const handleSubmit = async () => {
    // トークンを取得（未設定時はundefinedが返る）
    const recaptchaToken = await getRecaptchaToken(
      executeRecaptcha,
      RECAPTCHA_ACTIONS.REGISTER, // または独自のアクション名
    );

    // ClientService 経由で送る(ヘッダー X-Recaptcha-Token。例: features/core/auth/services/client/registration.ts)
    await submitClient.submit(data, { recaptchaToken });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* フォームフィールド */}

      {/* 規約テキスト（バッジ非表示時は必須） */}
      <RecaptchaBadge />

      <Button type="submit">送信</Button>
    </form>
  );
}
```

### サーバー側（routeFactory使用）

```ts
import { createApiRoute } from "@/wiring/apiRoute";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/register",
    operationType: "write",
    access: "public",
    recaptcha: {
      action: RECAPTCHA_ACTIONS.REGISTER,
      threshold: 0.7, // 省略 = lib/routeFactory の設定の recaptcha.threshold(上書き src/config/lib/routeFactory.config.ts)
    },
  },
  async (req) => {
    // reCAPTCHA検証はrouteFactoryが自動で実行
    // 検証失敗時は403エラーが返される
  },
);
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

### v2 チャレンジを受ける

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

### 新しいアクションを足す

1. `src/lib/recaptcha/constants.ts` にアクション名を追加:

```ts
export const RECAPTCHA_ACTIONS = {
  SEND_EMAIL_LINK: "send_email_link",
  REGISTER: "register",
  MY_NEW_ACTION: "my_new_action", // 追加
} as const;
```

2. 閾値(threshold)は使う所の設定ファイルが持つ

## API

### クライアント用 (`@/lib/recaptcha`)

| 名前 | 説明 |
|------|------|
| `getRecaptchaToken` | reCAPTCHA v3トークンを取得 |
| `useRecaptcha` | `{ executeRecaptcha }` を返すフック(無効時・Provider 外は undefined) |
| `RecaptchaProvider` | v3 の Provider(`src/wiring/AppProviders.tsx` が設置済み) |
| `RecaptchaBadge` | バッジ表示コンポーネント（設置したページで右下にバッジ表示） |
| `RecaptchaV2Challenge` | v2チャレンジモーダルコンポーネント |
| `useRecaptchaV2Challenge` | v2チャレンジ状態管理フック |
| `isV2ChallengeRequired` | エラーがv2チャレンジ要求かを判定 |
| `RECAPTCHA_ACTIONS` / `RecaptchaAction` | アクション名の定数と型 |
| `recaptchaSiteKey` / `hasRecaptchaSiteKey` | 版(`"v3"` / `"v2"`)のサイトキーと、有効か(20 文字以上) |
| `RecaptchaOverride` / `RecaptchaConfig` / `RecaptchaKeys` | 設定の上書きと設定の型 |

### サーバー用 (`@/lib/recaptcha/server`)

| 名前 | 説明 |
|------|------|
| `verifyRecaptcha` | v3トークンを検証 |
| `verifyRecaptchaV2` | v2トークンを検証 |
| `RecaptchaVerifyResult` | v3検証結果の型 |
| `RecaptchaV2VerifyResult` | v2検証結果の型 |
| `RECAPTCHA_V3_INTERNALS` / `RECAPTCHA_V2_INTERNALS` | 版ごとの設定(サイトキー・シークレット・検証の URL・有効か)。シークレットは読むたびに上書きの関数を呼ぶ |
| `RECAPTCHA_DEBUG` | デバッグの設定(ログ・スコアの上書き) |

### 設定(上書き `src/config/lib/recaptcha.config.ts`)

| キー | 説明 |
|------|------|
| `v3.siteKey` / `v2.siteKey` | サイトキー(公開)。上書きに `process.env.NEXT_PUBLIC_RECAPTCHA_*` の字面で書く。既定 `""` = 未設定 |
| `v3.secretKey` / `v2.secretKey` | シークレットを返す引数なしの関数(サーバーだけ。`./server` の中で使う時に呼ぶ)。既定 = 未設定 |

## Internals

### v3 / v2 ハイブリッド

v2 を有効にすると、v3 で中間スコアの場合に v2 チャレンジを出せる。

#### 閾値設定（`app-features.config.ts`）

```ts
signup: {
  recaptchaThreshold: 0.7,    // v3通過閾値
  recaptchaV2Threshold: 0.3,  // v2チャレンジ閾値
}
```

#### 判定フロー

```
スコア >= 0.7  → 通過
スコア 0.3〜0.7 → v2チャレンジ表示（HTTP 428）
スコア < 0.3   → ブロック（HTTP 403）
```

### スコア

- 範囲: 0.0（bot）〜 1.0（人間）
- 推奨閾値: 0.5（Googleのデフォルト）
- テスト時: 0.99 に設定するとほぼ全てブロックされる

### そのほか

- 無料枠: 100,000リクエスト/月
- 環境変数が空または短すぎる（20文字未満）場合は自動で無効化
- 依存パッケージ: `react-google-recaptcha-v3` - v3用Reactラッパー / `react-google-recaptcha` - v2用Reactラッパー
