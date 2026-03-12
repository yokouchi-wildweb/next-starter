# APIルート一覧

プロジェクト内のすべてのAPIルートとデモモード時のDB変更有無の一覧です。

## DB変更の判定ロジック

```
DB変更あり = (操作タイプ === "write") && (デモ時スキップ === false)
```

| 操作タイプ | デモ時スキップ | DB変更 | 安全性 |
|------------|----------------|--------|--------|
| read | - | ❌ なし | 🟢 安全 |
| write | ✅ スキップ | ❌ なし | 🟢 安全 |
| write | ❌ 実行 | ⚠️ あり | 🔴 要注意 |

---

## 全ルート一覧（DB変更有無付き）

### 汎用CRUDルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/[domain]` | GET | read | - | 🟢 なし | 一覧取得 |
| `/api/[domain]` | POST | write | ✅ | 🟢 なし | 新規作成 |
| `/api/[domain]/[id]` | GET | read | - | 🟢 なし | 単一取得 |
| `/api/[domain]/[id]` | PUT | write | ✅ | 🟢 なし | 更新 |
| `/api/[domain]/[id]` | DELETE | write | ✅ | 🟢 なし | 論理削除 |
| `/api/[domain]/search` | GET | read | - | 🟢 なし | 検索 |
| `/api/[domain]/count` | POST | read | - | 🟢 なし | 件数取得 |
| `/api/[domain]/upsert` | PUT | write | ✅ | 🟢 なし | Upsert |
| `/api/[domain]/[id]/duplicate` | POST | write | ✅ | 🟢 なし | 複製 |
| `/api/[domain]/[id]/hard-delete` | DELETE | write | ✅ | 🟢 なし | 物理削除 |
| `/api/[domain]/[id]/restore` | POST | write | ✅ | 🟢 なし | 復旧 |
| `/api/[domain]/bulk/delete-by-ids` | POST | write | ✅ | 🟢 なし | 一括削除 |
| `/api/[domain]/bulk/delete-by-query` | POST | write | ✅ | 🟢 なし | クエリ一括削除 |

### 認証ルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/auth/session` | GET | read | - | 🟢 なし | セッション取得 |
| `/api/auth/register` | POST | write | ✅ | 🟢 なし | 新規ユーザー登録 |
| `/api/auth/pre-register` | POST | write | ✅ | 🟢 なし | 事前登録 |
| `/api/auth/send-email-link` | POST | write | ✅ | 🟢 なし | メールリンク送信 |
| `/api/auth/demo/login` | POST | write | ❌ | 🔴 あり | デモログイン |
| `/api/auth/firebase/login` | POST | write | ❌ | 🔴 あり | Firebase認証ログイン |
| `/api/auth/local/login` | POST | write | ❌ | 🔴 あり | ローカルログイン |
| `/api/auth/logout` | POST | write | ❌ | 🔴 あり | ログアウト |

### ストレージルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/storage/upload` | POST | write | ✅ | 🟢 なし | ファイルアップロード |
| `/api/storage/delete` | POST | write | ✅ | 🟢 なし | ファイル削除 |

### 管理者ルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/admin/wallet/[userId]/adjust` | POST | write | ❌ | 🔴 あり | ウォレット残高調整 |

### ウォレット・決済ルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/wallet/history/batches` | GET | read | - | 🟢 なし | ウォレット履歴一覧 |
| `/api/wallet/purchase/[id]/status` | GET | read | - | 🟢 なし | 購入状態取得（milestoneResults含む） |
| `/api/wallet/purchase/initiate` | POST | write | ❌ | 🔴 あり | 購入開始 |

### セットアップルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/setting/setup` | POST | write | ❌ | 🔴 あり | 初期セットアップ |

### Webhookルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/webhook/payment` | POST | write | ❌ | 🔴 あり | 決済Webhook |

### その他ルート

| パス | メソッド | 操作 | スキップ | DB変更 | 説明 |
|------|----------|------|----------|--------|------|
| `/api/demo/get-env` | GET | read | - | 🟢 なし | 環境変数取得（開発用） |

---

## 関連ファイル

- `src/lib/routeFactory/createApiRoute.ts` - 基本ファクトリー
- `src/lib/routeFactory/createDomainRoute.ts` - ドメイン用ファクトリー
- `src/lib/routeFactory/README.md` - 詳細ドキュメント
