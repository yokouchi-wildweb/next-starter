# user ドメイン

ユーザー管理のコアドメイン。ユーザーテーブルとロール定義を管理する。

## エンティティとスキーマ

### ディレクトリ構造

```
src/features/core/user/
├── entities/
│   ├── index.ts          # 再エクスポート
│   ├── drizzle.ts        # Drizzle テーブル定義（DB スキーマ）
│   ├── schema.ts         # Zod バリデーションスキーマ
│   ├── model.ts          # 型定義
│   └── form.ts           # フォーム用型定義
├── roles/                # ロール設定 JSON
│   ├── index.ts          # 設定読み込み・エクスポート
│   ├── _admin.role.json  # コアロール（_ プレフィックス）
│   ├── _user.role.json   # コアロール
│   └── *.role.json       # 追加ロール
├── constants/
│   ├── index.ts          # 再エクスポート
│   ├── role.ts           # ロール派生定数
│   ├── status.ts         # ステータス定数
│   └── provider.ts       # プロバイダ定数
├── types/
│   ├── index.ts
│   ├── role.ts           # ロール関連型
│   └── profileField.ts   # プロフィールフィールド型
└── utils/
    ├── index.ts
    └── roleHelpers.ts    # ロールヘルパー関数
```

## ロール定義からデータベースへの流れ

```
roles/*.role.json
       ↓ import
roles/index.ts (ALL_ROLES)
       ↓ import
constants/role.ts (USER_ROLES)
       ↓ import
entities/drizzle.ts (UserRoleEnum)
       ↓ drizzle-kit push
PostgreSQL (user_role enum)
```

### 1. ロール設定 JSON

`roles/` ディレクトリに 1 ロール 1 ファイルで定義。

```
roles/
├── _admin.role.json      # コアロール（削除不可）
├── _user.role.json       # コアロール（削除不可）
├── editor.role.json      # 追加ロール
└── contributor.role.json # 追加ロール
```

**命名規則:**
- コアロール: `_` プレフィックス（システム保護）
- 追加ロール: プレフィックスなし

**{role}.role.json の構造:**
```json
{
  "id": "contributor",
  "label": "投稿者",
  "category": "user",
  "description": "コンテンツを投稿できる",
  "hasProfile": true,
  "isCore": false
}
```

| フィールド | 説明 |
|-----------|------|
| `id` | ロール識別子（DB に保存される値） |
| `label` | UI 表示名 |
| `category` | `"admin"` or `"user"`（管理画面での分類） |
| `description` | 説明文 |
| `hasProfile` | プロフィールテーブルを持つか |
| `isCore` | コアロールか（削除不可） |

### 2. ロール読み込み

`roles/index.ts` で JSON を読み込み、`ALL_ROLES` としてエクスポート。

```typescript
// roles/index.ts
import adminRole from "./_admin.role.json";
import userRole from "./_user.role.json";
import editorRole from "./editor.role.json";
import contributorRole from "./contributor.role.json";

export const ALL_ROLES: readonly RoleConfig[] = [
  adminRole, userRole,       // コアロール（先頭）
  editorRole, contributorRole // 追加ロール
];
```

### 3. 派生定数の生成

`constants/role.ts` で `ALL_ROLES` から各種定数を生成。

```typescript
// constants/role.ts
import { ALL_ROLES } from "../roles";

// DB スキーマ・バリデーション用の配列
export const USER_ROLES = ALL_ROLES.map((r) => r.id);
// → ["admin", "user", "editor", "contributor"]

// 型定義
export type UserRoleType = (typeof USER_ROLES)[number];
// → "admin" | "user" | "editor" | "contributor"
```

### 4. Drizzle テーブル定義

`entities/drizzle.ts` で PostgreSQL Enum とテーブルを定義。

```typescript
// entities/drizzle.ts
import { USER_ROLES } from "@/features/core/user/constants";

// PostgreSQL Enum 定義
export const UserRoleEnum = pgEnum("user_role", [...USER_ROLES]);

// ユーザーテーブル
export const UserTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  role: UserRoleEnum("role").notNull(),
  // ...
});
```

### 5. データベース反映

```bash
# スキーマ変更を DB に反映
pnpm drizzle-kit push
```

## ユーザーテーブル

### カラム定義

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID | 主キー |
| `providerType` | Enum | 認証プロバイダ種別 |
| `providerUid` | Text | プロバイダ側の UID |
| `email` | Text | メールアドレス |
| `name` | Text | 表示名 |
| `role` | Enum | ロール |
| `localPassword` | Text | ローカル認証用パスワードハッシュ |
| `status` | Enum | ステータス |
| `isDemo` | Boolean | デモユーザーフラグ |
| `lastAuthenticatedAt` | Timestamp | 最終認証日時 |
| `deletedAt` | Timestamp | 論理削除日時 |
| `createdAt` | Timestamp | 作成日時 |
| `updatedAt` | Timestamp | 更新日時 |

### Enum 定義

**user_role:**
```
admin, user, editor, contributor, ...
```

**user_provider_type:**
```
firebase, local
```

**user_status:**
```
pending, active, paused, withdrawn
```

## バリデーションスキーマ

`entities/schema.ts` で Zod スキーマを定義。

| スキーマ | 用途 |
|---------|------|
| `UserCoreSchema` | 全フィールドの基本スキーマ |
| `UserOptionalSchema` | 更新用（フィールドをオプショナル化） |
| `UserUpdateByAdminSchema` | 管理者による更新用 |
| `UserSelfUpdateSchema` | ユーザー自身による更新用 |

## ロール追加の手順

1. **JSON ファイル作成**
   ```bash
   # roles/reviewer.role.json を作成
   ```
   ```json
   {
     "id": "reviewer",
     "label": "レビュアー",
     "category": "user",
     "description": "コンテンツをレビューできる",
     "hasProfile": false,
     "isCore": false
   }
   ```

2. **roles/index.ts に追加**
   ```typescript
   import reviewerRole from "./reviewer.role.json";

   export const ALL_ROLES: readonly RoleConfig[] = [
     adminRole, userRole,
     editorRole, contributorRole, reviewerRole, // 追加
   ];
   ```

3. **DB スキーマ反映**
   ```bash
   pnpm drizzle-kit push
   ```

4. **hasProfile: true の場合**
   - `userProfile/profiles/{role}.profile.json` を作成
   - `userProfile/profiles/index.ts` に追加
   - `userProfile/entities/{role}Profile.ts` を作成
   - `userProfile/registry/` を更新

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/features/core/userProfile/` | ロール別プロフィール管理 |
| `src/registry/schemaRegistry.ts` | Drizzle スキーマ登録 |
| `src/lib/drizzle/` | Drizzle 設定 |
