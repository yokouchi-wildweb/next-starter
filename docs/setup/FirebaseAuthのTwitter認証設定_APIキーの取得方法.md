# Firebase Auth の X（Twitter）ログイン設定

Firebase Authentication の Twitter プロバイダで「X アカウントでログイン」を有効にする手順。

> **このドキュメントの対象**: ログイン手段としての X（Firebase の `TwitterAuthProvider`）。
> ログイン済みユーザーに X アカウントを紐付ける連携機能（`/api/auth/x/*`、`X_OAUTH2_CLIENT_ID` など）は別物で、こちらは OAuth 2.0 を使う。詳細は `src/features/core/auth/README.md`。

---

## 1. アプリ側で有効化する

- `src/config/app/app-features.config.ts` の `APP_FEATURES.auth.thirdPartyProviders.twitter` を `true` にする（既定 `false`）。
- プロバイダの生成は `src/features/core/auth/utils/createOAuthProvider.ts`（`TwitterAuthProvider`）。

## 2. X Developer Console 側

1. X の開発者コンソールでアプリを作成する。
2. **User authentication settings** で OAuth 1.0a を有効にする（Firebase の Twitter プロバイダは OAuth 1.0a を使う）。
3. **Callback URI** に次を登録する。登録しないと X から Firebase へのリダイレクトが拒否される。
   ```
   https://<FirebaseプロジェクトID>.firebaseapp.com/__/auth/handler
   ```
   独自ドメインを `authDomain` にしている場合は、そのドメインの `/__/auth/handler` も登録する。
4. メールアドレスを取得する場合は、Privacy Policy URL / Terms of Service URL の設定が必要。
5. **Keys and tokens** から **API Key** と **API Key Secret**（Consumer Keys）を控える。

> ⚠️ 使うのは Consumer Keys（API Key / API Key Secret）だけ。OAuth 2.0 の Client ID / Client Secret や Access Token は Firebase には入れない。

## 3. Firebase コンソール側

1. **Authentication > サインイン方法** で Twitter を有効化する。
2. 上記の API Key / API Key Secret を入力して保存する。
3. 表示されるリダイレクト URI が手順 2-3 で登録したものと一致していることを確認する。

---

## 4. よくあるエラー

| 症状 | 原因 | 対処 |
|---|---|---|
| 400 `Failed to generate request token. Please check your APIKey or APISecret.` | OAuth 2.0 の Client ID / Secret を登録している | Consumer Keys（API Key / Secret）に差し替える |
| X 側でリダイレクト拒否 | Callback URI 未登録・不一致 | `__/auth/handler` の URL を正確に登録する |
| 403 / コード 453（アクセスレベル不足） | 開発者アカウントのプランで、ログイン時に Firebase が呼ぶ API が使えない | X のプラン体系は頻繁に変わるため、現行プランで OAuth 1.0a のユーザー認証が使えるかを開発者コンソールで確認する |

> X API のプラン・料金体系は変更が多いので、このドキュメントには特定のプラン名を書いていない。導入時に開発者コンソールの最新情報を確認すること。
