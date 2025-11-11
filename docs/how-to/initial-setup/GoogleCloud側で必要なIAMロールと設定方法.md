# GoogleCloud側で必要なIAMロールと設定方法

## 背景

Next.js サーバー側での Firebase Admin SDK 使用時に、GCP プロジェクトの IAM 権限不足によるエラーが発生する場合があります。
これはGoogleCloud側でアクセスに必要なロールがサービスアカウントに付与することで解決できます。

特に **2024年5月以降**、新規プロジェクトではデフォルトのサービスアカウントへの自動ロール付与が無効化されたため（セキュリティ強化のため）、開発者自身で必要な権限を手動付与する必要があります。

---

## 包括的に付与すべき IAM ロール

Firebase を用いたアプリ開発で **最初に包括的に付与しておくと良い IAM ロール** は以下の通りです。  
これらを Firebase Admin SDK 用サービスアカウントに付与することで、Firestore・Storage・Functions・Hosting・Auth など主要な Firebase サービスへのアクセス権限が揃います。

### 1. Service Usage Consumer（roles/serviceusage.serviceUsageConsumer）

- **必須ロール**。
- 理由: プロジェクト内の Google API サービスを呼び出す権限。  
  Firebase Authentication（Identity Toolkit API）などのバックエンド API を使用する際に必要。
- Firebase Admin SDK 経由での全てのサービス利用における前提権限。

---

### 2. Firebase Admin（roles/firebase.admin）

- **推奨ロール（包括的権限）**。
- 内容: Firebase プロダクト全体へのフルアクセス権限。  
  Firestore、Cloud Storage for Firebase、Authentication、Hosting、Cloud Functions などを網羅。
- 含まれる主な権限:
    - Firestore への読み書き（`datastore.entities.create/update/delete`）
    - 認証ユーザーの管理（`firebaseauth.users.*`）
    - Storage バケットの CRUD 操作
    - Hosting / Functions のデプロイ操作など
- 基本的にこのロール 1 つで Next.js + Firebase Admin SDK の主要操作をすべてカバー可能。

---

### 3. Firebase Admin SDK Administrator Service Agent（roles/firebase.sdkAdminServiceAgent）

- 上級者向け。Firebase Admin SDK 専用のサービスエージェント用ロール。
- Admin SDK から利用可能な Firebase プロダクト（Firestore・Auth・Storage）への完全な読み書き権限を付与。
- 通常は `roles/firebase.admin` で十分。セキュリティ上、一般ユーザーには付与しないことが推奨。

---

## （参考）個別サービスごとのロール

セキュリティ上、最小権限設計をしたい場合は以下のように分割も可能です。

| サービス | ロール | 権限内容 |
|-----------|--------|----------|
| **Firestore** | `roles/datastore.owner` or `roles/datastore.user` | Firestore（Datastore モード）の読み書き権限 |
| **Firebase Storage** | `roles/firebasestorage.admin` | バケット・オブジェクトの管理権限 |
| **Firebase Authentication** | `roles/firebaseauth.admin` | ユーザー管理、メール送信、プロバイダ設定 |
| **Firebase Hosting** | `roles/firebasehosting.admin` | サイトとチャネルの管理権限（SSR/API に必要な場合あり） |
| **Cloud Functions** | `roles/cloudfunctions.admin` | 関数のデプロイ・更新・閲覧権限（Invoker権限のみでも可） |
| **Firebase Rules** | `roles/firebaserules.admin` | Firestore/Storage のセキュリティルール管理権限 |

---

## まとめ

- 新規 Firebase プロジェクトではデフォルト権限が付与されないため、初期設定として以下を付与するのがおすすめ：
    - ✅ `roles/serviceusage.serviceUsageConsumer`
    - ✅ `roles/firebase.admin`
- これにより、Firestore / Auth / Storage / Functions / Hosting などを Next.js サーバーから安全かつ包括的に利用可能。
- 開発初期は包括的ロールで構築し、本番リリース時に必要最小限ロールへ絞り込むのが現実的な運用方針。

---

## 参考資料

- [Firebase IAM ロール一覧（公式）](https://firebase.google.com/docs/projects/iam/roles-predefined)
- [Cloud IAM ロールと権限（Google Cloud）](https://cloud.google.com/iam/docs/understanding-roles)
- [権限不足エラーの対処（Zenn 記事）](https://zenn.dev)  
