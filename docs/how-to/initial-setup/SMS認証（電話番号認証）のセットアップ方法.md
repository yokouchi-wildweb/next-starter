# SMS認証（電話番号認証）のセットアップ方法

このドキュメントでは、Firebase Phone Authentication を利用した SMS 認証機能のセットアップ手順をまとめます。
Firebase Console と Google Cloud Console の両方で設定が必要です。

## アーキテクチャ（ハイブリッド方式）

本テンプレートでは「ハイブリッド方式」を採用しています：

1. **Firebase側**: 既存ユーザー（メール認証済み）に電話番号プロバイダをリンク
   - `linkWithPhoneNumber()` を使用
   - 将来的なMFA（多要素認証）対応が可能
   - アカウントリカバリーの手段として利用可能

2. **自前DB側**: `phoneNumber` と `phoneVerifiedAt` を保存
   - ビジネスロジックでの信用度判定に使用
   - 1電話番号1アカウントの制約を管理

この方式により、Firebase の認証基盤の恩恵を受けつつ、自前のビジネスロジックにも対応できます。

---

## 1. 前提条件

- Firebase プロジェクトが作成済みであること
- Firebase Authentication が有効化されていること
- Firebase プロジェクトが Blaze プラン（従量課金）であること
  - 電話認証は無料プラン（Spark）では利用できません
- Google Cloud Console へのアクセス権限があること

> Firebase SDK バージョンは v11 以上を推奨します。v11 以降では reCAPTCHA Enterprise による SMS 防御機能が有効化されます。

---

## 2. Firebase Console での設定

### 2.1 電話番号プロバイダの有効化

1. [Firebase コンソール](https://console.firebase.google.com/) で対象プロジェクトを開きます。
2. サイドバーから **Authentication** > **Sign-in method**（ログイン方法）タブを開きます。
3. プロバイダ一覧から **電話番号** をクリックします。
4. トグルスイッチを **有効** にします。
5. 「保存」をクリックして設定を保存します。

### 2.2 テスト用電話番号の登録（開発環境用）

開発・テスト環境では、実際に SMS を送信せずに認証フローをテストするため、テスト用電話番号を登録します。

1. **Authentication** > **Sign-in method** > **電話番号** の設定画面を開きます。
2. 「テスト用の電話番号（省略可）」セクションを展開します。
3. 以下の情報を入力します：
   - **電話番号**: E.164 形式で入力（例: `+81 90-1234-5678`）
   - **確認コード**: 6桁の任意の数字（例: `123456`）
4. 「追加」ボタンをクリックします。
5. 設定ダイアログを閉じて保存します。

> **注意**: テスト用電話番号は最大10件まで登録できます。本番環境では実際の SMS が送信されるため、テスト番号は開発時のみ使用してください。

### 2.3 承認済みドメインの確認

1. **Authentication** > **Settings**（設定）タブを開きます。
2. 「承認済みドメイン」セクションを確認します。
3. 以下のドメインが含まれていることを確認してください：
   - `localhost`（開発環境用）
   - 本番ドメイン（例: `example.com`）
   - Firebase のデフォルトドメイン（`<project-id>.firebaseapp.com`）

---

## 3. Google Cloud Console での設定

### 3.1 reCAPTCHA Enterprise API の有効化

Firebase Phone Authentication では reCAPTCHA Enterprise を使用して不正利用を防止します。この API を有効化しないと `auth/invalid-app-credential` エラーが発生します。

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスします。
2. Firebase プロジェクトと同名の GCP プロジェクトを選択します。
3. 左側メニューから **セキュリティ** > **reCAPTCHA Enterprise** を開きます。
   - または検索バーで「reCAPTCHA Enterprise」を検索します。
4. 「API を有効にする」または「有効にする」ボタンをクリックします。
5. API が有効化されるまで数秒待ちます。

> **補足**: reCAPTCHA Enterprise API は従量課金制ですが、月間1万件までの評価は無料枠に含まれます。詳細は [reCAPTCHA Enterprise の料金](https://cloud.google.com/recaptcha-enterprise/pricing) を確認してください。

---

## 4. アプリ側の設定

### 4.1 環境変数の確認

SMS 認証に追加の環境変数は不要です。既存の Firebase 設定が正しく行われていれば動作します。

確認すべき環境変数：
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
```

### 4.2 reCAPTCHA コンテナの配置

アプリケーション内で reCAPTCHA の invisible モードを使用するため、DOM 内に reCAPTCHA 用のコンテナ要素が必要です。本テンプレートでは `usePhoneVerification` フックが自動的に処理しますが、コンテナ ID（`phone-verification-recaptcha`）の要素がレンダリングされていることを確認してください。

---

## 5. トラブルシューティング

### 5.1 `auth/invalid-app-credential` エラー

**原因**: reCAPTCHA Enterprise API が有効化されていない、または reCAPTCHA の初期化に失敗している。

**解決方法**:
1. Google Cloud Console で reCAPTCHA Enterprise API が有効になっているか確認
2. ブラウザのキャッシュをクリアしてページを再読み込み
3. 開発環境の場合、テスト用電話番号が正しく登録されているか確認

### 5.2 `Failed to initialize reCAPTCHA Enterprise` エラー

**原因**: reCAPTCHA Enterprise の初期化に失敗している。

**解決方法**:
1. reCAPTCHA Enterprise API が有効化されているか確認
2. Firebase Authentication の承認済みドメインに現在のドメインが含まれているか確認
3. Firebase SDK のバージョンが v11 以上であることを確認

### 5.3 SMS が届かない

**原因**: 以下のいずれかが考えられます。

- テスト用電話番号を使用している（テスト番号には実際の SMS は送信されない）
- 電話番号の形式が正しくない
- SMS 送信クォータの上限に達している

**解決方法**:
1. 本番テスト時は実際の電話番号を使用
2. 電話番号を E.164 形式（`+819012345678`）で入力しているか確認
3. Firebase コンソールで SMS 送信ログを確認

### 5.4 「この電話番号は既に使用されています」エラー

**原因**: 別のユーザーアカウントで同じ電話番号が既に認証済み。

**解決方法**:
- 本テンプレートでは1つの電話番号は1つのアカウントにのみ紐付け可能な仕様です
- テスト時は異なる電話番号を使用するか、既存の認証情報をリセット

---

## 6. 本番環境での注意事項

### 6.1 SMS 送信クォータ

- 新規プロジェクトのデフォルトクォータは **1日あたり1,000件**
- クォータを増やすには Identity Platform へのアップグレードが必要
- Firebase コンソールの Authentication 画面上部に表示されるバナーから申請可能

### 6.2 コスト管理

- SMS 送信には通信キャリアへの送信料がかかります
- 国・地域によって料金が異なります（日本国内は比較的安価）
- [Firebase Phone Auth の料金](https://firebase.google.com/pricing) で最新情報を確認してください

### 6.3 不正利用対策

- reCAPTCHA Enterprise による自動防御が有効
- 異常な送信パターンは Firebase により自動的にブロックされる場合があります
- アプリ側でもレート制限（再送信間隔など）を実装済み

---

## 7. 設定チェックリスト

セットアップ完了後、以下の項目を確認してください：

- [ ] Firebase Authentication で電話番号プロバイダが有効
- [ ] Google Cloud Console で reCAPTCHA Enterprise API が有効
- [ ] 承認済みドメインに `localhost` と本番ドメインが含まれている
- [ ] 開発環境用のテスト電話番号が登録されている
- [ ] テスト用電話番号で認証フローが完了することを確認
- [ ] データベースに `phoneNumber` と `phoneVerifiedAt` が正しく保存されることを確認

---

## 関連ドキュメント

- [Neon, Firebase など各種バックエンドサービスの設定方法](Neon_Firebaseなど各種バックエンドサービスの設定方法.md)
- [GoogleCloud 側で必要な IAM ロールと設定方法](GoogleCloud側で必要なIAMロールと設定方法.md)
- [Firebase Phone Authentication 公式ドキュメント](https://firebase.google.com/docs/auth/web/phone-auth)
