# userProfile ドメイン

ロール別プロフィールを管理するコアドメイン。
ロールに応じたプロフィールテーブルの CRUD 操作を統一的なインターフェースで提供する。

## 概要

- **役割**: ロール別プロフィールの統一管理
- **パターン**: Registry + Factory パターン
- **設定ファイル**: JSON 形式（1ロール1ファイル）

## ディレクトリ構造

```
src/features/core/userProfile/
├── components/common/          # UI コンポーネント
│   ├── RoleSelector.tsx        # ロール選択（汎用）
│   ├── RoleProfileFields.tsx   # プロフィールフィールド（汎用）
│   └── index.ts
├── entities/                   # Drizzle テーブル定義 [自動生成]
│   └── {role}Profile.ts
├── profiles/                   # プロフィールフィールド設定 JSON [自動生成]
│   ├── index.ts                # 設定読み込み・エクスポート
│   └── {role}.profile.json     # hasProfile: true のロールのみ
├── registry/                   # レジストリ [自動生成]
│   ├── index.ts                # 再エクスポートのみ
│   ├── profileTables.ts        # テーブル再エクスポート
│   └── profileBases.ts         # ロール → ProfileBase マッピング
├── types/                      # 型定義
│   ├── index.ts
│   └── profileBase.ts          # ProfileBase インターフェース
├── utils/                      # ユーティリティ
│   ├── index.ts                # クライアント安全なエクスポートのみ
│   ├── createProfileBase.ts    # ProfileBase ファクトリ [サーバー専用]
│   ├── profileBaseHelpers.ts   # レジストリヘルパー [サーバー専用]
│   └── profileFieldHelpers.ts  # フィールドヘルパー [クライアント/サーバー共通]
└── services/server/            # サーバーサービス
    ├── operations/             # 各操作の実装
    │   ├── index.ts
    │   ├── getProfile.ts
    │   ├── upsertProfile.ts
    │   ├── updateProfile.ts
    │   ├── deleteProfile.ts
    │   └── hasProfile.ts
    └── userProfileService.ts   # 公開インターフェース
```

## 設定ファイル

### ロール設定（user ドメイン）

`src/features/core/user/roles/` にロール定義を配置。

```
roles/
├── index.ts                # 設定読み込み・ALL_ROLES エクスポート
├── _admin.role.json        # コアロール（_ プレフィックス）
├── _user.role.json         # コアロール
├── editor.role.json        # 追加ロール
└── contributor.role.json   # 追加ロール（hasProfile: true）
```

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

### プロフィールフィールド設定（userProfile ドメイン）

`hasProfile: true` のロールのみ、対応する設定ファイルを配置。

```
profiles/
├── index.ts
└── contributor.profile.json
```

**{role}.profile.json の構造:**
```json
{
  "roleId": "contributor",
  "fields": [
    {
      "name": "organization_name",
      "label": "組織名",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true,
      "placeholder": "株式会社〇〇",
      "tags": ["registration", "mypage"]
    }
  ]
}
```

## 自動生成ファイル

設定 JSON から以下が自動生成される。

### entities/{role}Profile.ts

各ロールのプロフィールテーブル定義。

```typescript
// 例: entities/contributorProfile.ts
export const ContributorProfileTable = pgTable("contributor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  organizationName: varchar("organization_name", { length: 255 }),
  // ... profile.json の fields から生成
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### registry/profileTables.ts

テーブル定義の再エクスポート。アンカーコメント間が自動更新される。

```typescript
// === AUTO-GENERATED EXPORTS START ===
export * from "../entities/contributorProfile";
// === AUTO-GENERATED EXPORTS END ===
```

### registry/profileBases.ts

ロール → ProfileBase のマッピング。アンカーコメント間が自動更新される。

```typescript
// === AUTO-GENERATED IMPORTS START ===
import { ContributorProfileTable } from "../entities/contributorProfile";
// === AUTO-GENERATED IMPORTS END ===

export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  // === AUTO-GENERATED ENTRIES START ===
  contributor: createProfileBase(ContributorProfileTable),
  // === AUTO-GENERATED ENTRIES END ===
};
```

## ユーティリティ

### クライアント/サーバー分離

| ファイル | 環境 | 用途 |
|---------|------|------|
| `utils/index.ts` | 共通 | クライアント安全なエクスポートのみ |
| `profileFieldHelpers.ts` | 共通 | フィールド取得・フィルタリング |
| `createProfileBase.ts` | サーバー専用 | ProfileBase ファクトリ |
| `profileBaseHelpers.ts` | サーバー専用 | レジストリアクセス |

**重要**: サーバー専用ファイルは直接パスで import すること。

```typescript
// ❌ NG: クライアントコンポーネントでエラー
import { getProfileBase } from "../utils";

// ✅ OK: サーバーコンポーネント/サービスで直接 import
import { getProfileBase } from "../utils/profileBaseHelpers";
```

### profileFieldHelpers.ts（クライアント/サーバー共通）

```typescript
type ProfileFieldTag = "admin" | "registration" | "mypage" | "notification";

// ロールのプロフィールフィールドを取得
getProfileFields(role: UserRoleType): ProfileFieldConfig[]

// 指定タグを持つフィールドを取得
getFieldsByTags(role: UserRoleType, tags: ProfileFieldTag[], excludeHidden?: boolean): ProfileFieldConfig[]

// 本登録画面用フィールド
getRegistrationFields(role: UserRoleType): ProfileFieldConfig[]

// マイページ用フィールド
getMyPageFields(role: UserRoleType): ProfileFieldConfig[]

// 管理画面用フィールド（hidden 除く）
getAdminFields(role: UserRoleType): ProfileFieldConfig[]
```

### profileBaseHelpers.ts（サーバー専用）

```typescript
// プロフィールを持つロールの一覧
PROFILE_ROLES: string[]

// ロールがプロフィールを持つか確認
hasProfileBase(role: string): boolean

// ロールに対応する ProfileBase を取得
getProfileBase(role: string): ProfileBase | null
```

## ProfileBase インターフェース

全ロールのプロフィールに対して統一的な CRUD 操作を提供。

```typescript
type ProfileBase = {
  // 基本 CRUD（createCrudService から継承）
  get: (id: string) => Promise<Record<string, unknown> | null>;
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  remove: (id: string) => Promise<void>;
  upsert: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;

  // userId ベースの操作
  getByUserId: (userId: string) => Promise<Record<string, unknown> | null>;
  existsByUserId: (userId: string) => Promise<boolean>;
  updateByUserId: (userId: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  removeByUserId: (userId: string) => Promise<boolean>;
};
```

## サービス操作

### userProfileService

```typescript
// プロフィール取得
getProfile(userId: string, role: UserRoleType): Promise<Record<string, unknown> | null>

// プロフィール作成/更新（upsert）
upsertProfile(userId: string, role: UserRoleType, data: ProfileUpsertData): Promise<Record<string, unknown> | null>

// プロフィール更新
updateProfile(userId: string, role: UserRoleType, data: ProfileUpdateData): Promise<Record<string, unknown> | null>

// プロフィール削除
deleteProfile(userId: string, role: UserRoleType): Promise<boolean>

// プロフィール存在確認
hasProfile(userId: string, role: UserRoleType): Promise<boolean>
```

## コンポーネント

### RoleSelector

ロール選択 UI。カテゴリ指定、入力タイプ（select/radio）切り替え可能。

```tsx
<RoleSelector
  control={control}
  name="role"
  categories={["user"]}           // ロールカテゴリ
  inputType="radio"               // "select" | "radio"
  radioDisplayType="standard"     // ラジオの表示タイプ
  showDescription                 // 説明文表示
/>
```

### RoleProfileFields

ロールに応じたプロフィールフィールドを動的レンダリング。

```tsx
<RoleProfileFields
  methods={methods}
  role={selectedRole}
  tags={["registration"]}         // 表示するタグ（未指定で全フィールド）
  fieldPrefix="profileData"       // フィールド名プレフィックス
/>
```

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/features/core/user/roles/` | ロール設定 JSON |
| `src/features/core/user/constants/role.ts` | ロール派生定数 |
| `src/features/core/user/utils/roleHelpers.ts` | ロールヘルパー関数 |
| `src/features/core/user/types/role.ts` | ロール関連型定義 |
| `src/registry/schemaRegistry.ts` | Drizzle スキーマ登録 |

## 対話型スクリプトの流れ（予定）

1. ロール基本設定収集 → `user/roles/{role}.role.json` 作成
2. `hasProfile: true` なら → フィールド収集 → `userProfile/profiles/{role}.profile.json` 作成
3. 自動生成実行 → entities/, registry/ 更新
