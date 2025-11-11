# Neon Firebaseなど各種バックエンドサービスの設定方法

このドキュメントでは、[クイックスタート: 環境構築からデプロイまでの方法](./クイックスタート_環境構築からデプロイまでの方法.md) の関連として、
Firebase コンソールおよび関連する外部サービス（Neon など）の設定手順をまとめます。
プロジェクト作成直後に行う初期設定をチームで統一し、`.env.*` や `apphosting.yaml` に正しい値を反映できるようにすることが目的です。

---

## 1. 事前準備

- Firebase プロジェクト（GCP プロジェクト）が作成済みであること
- Firebase CLI にログイン済みで、`firebase use` で対象プロジェクトを切り替えられること
- Neon などの PostgreSQL サービスにアクセスできるアカウントを保有していること
- プロジェクトのオーナー、または設定変更に必要な IAM 権限を付与された Google アカウントで Firebase コンソールへアクセスできること

> Google Cloud 側の IAM 権限詳細は [GoogleCloud 側で必要な IAM ロールと設定方法](./GoogleCloud側で必要なIAMロールと設定方法.md) を参照してください。

---

## 2. Neon から DATABASE_URL を取得する

1. [Neon コンソール](https://console.neon.tech/) にログインします。
2. プロジェクトのダッシュボードで対象ブランチ（通常は `main` や `dev`）を選択します。
3. 画面右上の **Connect** ボタンをクリックし、`Prisma` もしくは `psql` タブを開くと接続文字列が表示されます。
4. `postgresql://<user>:<password>@<host>/<database>` 形式の URL をコピーし、`.env.development` / `.env.production` の `DATABASE_URL` に貼り付けます。
5. パスワードがマスクされている場合は **Reset Password** をクリックして新しい値を発行し、再設定後に URL を更新します。

> チーム内で共有する場合は Secret Manager や 1Password など安全なチャネルを利用してください。直接チャットに貼り付けない方針です。

---

## 3. Firebase コンソールでアプリを登録する（Web アプリ）

1. [Firebase コンソール](https://console.firebase.google.com/) で対象プロジェクトを開きます。
2. サイドバーの **プロジェクト概要** > **アプリを追加** をクリックし、Web（`</>` アイコン）を選択します。
3. アプリニックネームを入力し、Firebase Hosting を利用する場合は「このアプリで Firebase Hosting を設定する」にチェックを入れます。
4. **アプリを登録** を押すと、ブラウザ SDK 用の設定スニペットが表示されます。これが `NEXT_PUBLIC_FIREBASE_*` 系の値になります。
5. この段階では SDK スニペットをコピーせず、次節の手順で個別に値を控えます。

> すでに Web アプリが登録済みの場合は、上部ナビの歯車アイコンから「プロジェクトの設定」を開き、登録済みアプリ一覧から該当アプリを選択してください。

---

## 4. ブラウザ SDK 用環境変数の取得

1. Firebase コンソールの **プロジェクト設定** > **全般** タブを開きます。
2. 「マイアプリ」セクションで Web アプリを選択すると、**Firebase SDK snippet** が表示されます。
3. `const firebaseConfig = { ... }` の各キーが Next.js の公開環境変数に対応します。
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`
4. `.env.development` / `.env.production` に上記キーを追記し、`.gitignore` の対象になっていることを再確認します。
5. App Hosting を利用する場合は `apphosting.yaml` の `env` セクションにも同じ値を追加します。

> `NEXT_PUBLIC_` プレフィックスはブラウザへ公開されるため、機密性の高い値を含めないよう注意してください。

---

## 5. サーバー側 SDK 用サービスアカウントの取得

1. Firebase コンソールの **プロジェクト設定** > **サービスアカウント** タブを開きます。
2. 「Firebase Admin SDK」のカードから **新しい秘密鍵の生成** をクリックします。
3. JSON ファイルがダウンロードされるので、`firebase-service-account.json` などチームで決めた命名規則に従い安全に保管します。
4. `MY_SERVICE_ACCOUNT_KEY` などアプリ側で参照する環境変数に JSON を文字列として埋め込む場合は、`"` のエスケープと改行の `\n` 変換を忘れないでください。
5. 生成した秘密鍵はローテーション管理されません。権限変更やメンバー退職時には必ず鍵を再発行し、古い鍵を無効化します。

> サービスアカウントを直接リポジトリにコミットすることは厳禁です。Vault, Secret Manager, GitHub Actions の暗号化シークレットなど安全な経路で共有してください。

---

## 6. Firebase Storage / Firestore の初期設定

### 6.1 Storage（バケット）

1. Firebase コンソールの **Storage** を開き、「開始する」からバケットを作成します。
2. 本番運用ではリージョンを `asia-northeast1` などアプリの利用地域に合わせて選択します。
3. 初期アクセスルールは `allow read, write: if false;` となっていることが多いため、開発用途では暫定的に `request.auth != null` を条件にするなど最小限の許可に留めます。
4. ルール編集後は **公開** をクリックしてデプロイします。
5. バケット名は `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` と一致する必要があるため、設定を変更した場合は環境変数も更新します。

### 6.2 Firestore

1. **Firestore Database** を開き、データベースを作成します。モードは「ネイティブモード」を選択してください。
2. リージョンは Storage と同じリージョンを選択するのが推奨です。
3. 初期ルールは段階的に厳格化します。
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
4. 本番ローンチ前にはドメイン要件に合わせた細かいセキュリティルールへ更新し、Pull Request でレビューを受けるよう運用します。
5. `firestore.rules` / `storage.rules` を更新した場合は `firebase deploy --only firestore:rules,storage:rules` で同期してください。

---

## 7. Firebase Authentication の初期設定

1. **Authentication** > **サインイン方法** を開き、利用するプロバイダを有効化します。
2. 例: Google ログインを有効にする場合はクライアント ID / シークレットを入力し、承認済みリダイレクト URI に `https://<project-id>.firebaseapp.com/__/auth/handler` を設定します。
3. メール/パスワードを利用する場合は、追加でテンプレートメールの送信者名やサポートメールアドレスを設定します。
4. 認証フローをカスタムドメインで運用する場合は Hosting 側にドメインマッピングを構成し、リダイレクト URI を再設定してください。
5. 本番前にテストユーザーを作成し、`Authentication > ユーザー` から想定通りの属性が保存されているか確認します。

---

## 8. Google Cloud IAM の確認

- Firebase プロジェクトは同名の GCP プロジェクトと連動しています。追加のサービス（Cloud Functions、Cloud Run 等）を利用する場合は IAM 権限が必要です。
- 詳細なロール割り当てやサービスアカウントのベストプラクティスは [GoogleCloud 側で必要な IAM ロールと設定方法](./GoogleCloud側で必要なIAMロールと設定方法.md) を参照し、各メンバーが必要最低限の権限で運用してください。
- Terraform や IaC ツールで管理している場合は、変更後に `docs/how-to` 配下の関連手順も更新し、ドリフトがないようにします。

---

## 9. チームで共有しておくと便利なメモ

- **環境変数シート**: `.env` のキーと値の保管場所を Notion や Spreadsheet で一覧化し、更新履歴を残すと onboarding がスムーズです。
- **ローテーションスケジュール**: サービスアカウント鍵や OAuth クライアントシークレットのローテーション予定を決めておくと、緊急対応が減ります。
- **権限依頼フロー**: 新メンバーが Firebase/Neon へアクセスする際の依頼テンプレート（Jira チケット例、Slack 定型文など）を用意しておくと運用コストが下がります。
- **監査ログの確認手順**: Firebase / GCP のアクティビティログをどこで確認するかをドキュメント化し、怪しい操作を検知した際の連絡ルートを定めておきます。

