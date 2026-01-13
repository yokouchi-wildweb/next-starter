# userProfile ドメイン

ロール別プロフィールを管理するコアドメイン。
ロールに応じたプロフィールテーブルの CRUD 操作を統一的なインターフェースで提供する。

## 概要

- **役割**: ロール別プロフィールの統一管理
- **パターン**: Registry + Factory パターン
- **自動生成**: `roles.config.ts` から一部ファイルを自動生成

## ディレクトリ構造

```
src/features/core/userProfile/
├── components/common/          # UI コンポーネント
│   ├── RoleSelector.tsx        # ロール選択（汎用）
│   ├── RoleProfileFields.tsx   # プロフィールフィールド（汎用）
│   └── index.ts
├── entities/                   # Drizzle テーブル定義 [自動生成]
│   └── {role}Profile.ts
├── registry/                   # レジストリ [自動生成]
│   ├── index.ts                # 再エクスポートのみ
│   ├── profileTables.ts        # テーブル再エクスポート
│   └── profileBases.ts         # ロール → ProfileBase マッピング
├── types/                      # 型定義
│   ├── index.ts
│   └── profileBase.ts          # ProfileBase インターフェース
├── utils/                      # ユーティリティ
│   ├── index.ts
│   ├── createProfileBase.ts    # ProfileBase ファクトリ
│   └── profileBaseHelpers.ts   # ヘルパー関数
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

## 自動生成ファイル

`roles.config.ts` の `CUSTOM_ROLES` 定義から以下が自動生成される。

### entities/{role}Profile.ts

各ロールのプロフィールテーブル定義。

```typescript
// 例: entities/contributorProfile.ts
export const ContributorProfileTable = pgTable("contributor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  displayName: varchar("display_name", { length: 255 }),
  // ... roles.config.ts の profileFields から生成
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

## ユーティリティ関数

### utils/profileBaseHelpers.ts

```typescript
// プロフィールを持つロールの一覧
PROFILE_ROLES: string[]

// ロールがプロフィールを持つか確認
hasProfileBase(role: string): boolean

// ロールに対応する ProfileBase を取得
getProfileBase(role: string): ProfileBase | null
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

## 設定ファイルとの連携

### src/config/app/roles.config.ts

```typescript
export const CUSTOM_ROLES: CustomRoleConfig<ProfileFieldTag>[] = [
  {
    id: "contributor",
    name: "コントリビューター",
    category: "user",
    profileFields: [
      {
        name: "display_name",
        label: "表示名",
        fieldType: "string",
        formInput: "textInput",
        tags: ["registration", "mypage", "admin"],
      },
      // ...
    ],
  },
];
```

## 関連ファイル

- `src/config/app/roles.config.ts` - ロール設定（自動生成の元）
- `src/features/core/user/constants/role.ts` - ロール定数・ヘルパー関数
- `src/features/core/user/types/role.ts` - ロール関連型定義
- `src/registry/schemaRegistry.ts` - Drizzle スキーマ登録
