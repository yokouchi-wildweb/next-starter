# Firebase Auth のTwitter認証設定_APIキーの取得方法

## 1. Firebaseで必要なTwitter認証情報（Consumer Key / Secret）

FirebaseのTwitterログインでは、**Twitter Developer Portal**で発行される  
**Consumer API Key（API Key）** と **API Secret Key（API Secret）** を使用します。

- Twitter Developer Portal → 「Keys and Tokens（またはConsumer Keys）」から取得
- Firebaseコンソール → 「認証 > サインイン方法」でTwitterを有効化
- 上記API KeyとSecretを入力して保存

> ⚠️ **注意**  
> 「Authentication Tokens」「OAuth 2.0 Client ID」「Client Secret」は使用しません。  
> FirebaseのTwitterプロバイダは **OAuth 1.0a**（3-legged OAuth）を利用します。

### コールバックURL設定

Twitterアプリの「Authorization callback URL」に以下を登録します。

```
https://<FirebaseプロジェクトID>.firebaseapp.com/__/auth/handler
```

これを設定しないと、TwitterからFirebaseへのリダイレクトが拒否されます。

---

## 2. Essentialプランでの利用制限

Twitter APIの**Essential（無料）プラン**では、  
FirebaseのTwitterログインに必要な **API v1.1 エンドポイント** が使用できません。

Firebaseはログイン後、以下のAPIを呼び出してユーザー情報を取得します。

```
GET https://api.twitter.com/1.1/account/verify_credentials.json
```

しかしEssentialプランではv2のみ許可されているため、  
次のようなエラー（コード453）が発生します。

> “You currently have Essential access which includes access to Twitter API v2 endpoints only...”

つまり、**EssentialプランではFirebaseのTwitterログインは完了しません**。

---

## 3. Elevated以上のアクセスが必要

Firebase連携を正常動作させるには、  
Twitter APIのアクセスレベルを **Elevated** 以上に引き上げる必要があります。

### アップグレード手順

1. Twitter Developer PortalでElevatedアクセス申請を行う
2. 承認後、v1.1エンドポイントへのアクセスが可能になる
3. FirebaseでのTwitterログインが正常に動作するようになる

> もしElevated申請ができない場合、  
> 有料の **Basicプラン** 以上への加入が必要になる場合があります。

**要点:**  
Essential → Firebaseログイン不可  
Elevated以上 → 正常動作（verify_credentials呼び出し可能）

---

## 4. 400エラーの原因と解決方法

### 原因

Firebaseに登録する認証情報を誤って  
**OAuth 2.0のClient ID/Secret** にしてしまうと、  
OAuth 1.0aフローでリクエストトークンが取得できず、  
以下のような400 Bad Requestエラーが発生します。

> “Failed to generate request token. Please check your APIKey or APISecret.”

### 正しい設定手順

#### 🔹 Twitter Developer Portal側

1. アプリ作成後、「Consumer API Key」と「API Secret Key」を取得
2. OAuth 1.0a (3-legged OAuth) を有効化
3. Callback URLに  
   `https://<プロジェクトID>.firebaseapp.com/__/auth/handler` を登録
4. メールアドレス取得を有効にする場合はPrivacy Policy URLなども設定

#### 🔹 Firebase側

1. 「認証 > サインイン方法」でTwitterを有効にする
2. 上記API Key / Secretを入力（※OAuth2ではない）
3. Firebaseが表示するRedirect URIをTwitter側に登録

#### 🔹 動作確認

- 設定完了後にTwitterログインを実行
- 成功時：Firebaseが `/1.1/account/verify_credentials.json` にアクセスし  
  ユーザー情報を取得 → ログイン成功
- 失敗時（コード453）：Essentialプランの制限 → Elevatedにアップグレード

---

## 5. まとめ

| エラー種別 | 原因 | 対処方法 |
|-------------|-------|-----------|
| **400 Bad Request** | OAuth2のClient ID/Secretを誤登録 | API Key / Secret（OAuth1.0a）に修正 |
| **403 / 453 Error** | Essentialプランでv1.1が使えない | Twitter APIをElevated以上にアップグレード |

> ✅ **最終的な要点**
> - FirebaseではOAuth1.0aのAPI Key/Secretを使用
> - コールバックURLを正しく登録
> - Essentialでは動作せず、Elevated以上が必要

以上の設定を正しく行えば、Firebase × Twitter認証が正常に動作します。
