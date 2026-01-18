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
├── constants/                  # 定数
│   └── fieldTag.ts             # フィールドタグ定義
├── generated/                  # 自動生成ファイル [DO NOT EDIT]
│   ├── {role}/
│   │   ├── drizzle.ts          # Drizzle テーブル定義
│   │   ├── schema.ts           # Zod スキーマ
│   │   ├── form.ts             # フォーム型定義
│   │   ├── model.ts            # モデル型定義
│   │   ├── presenters.ts       # プレゼンター
│   │   └── index.ts
│   └── index.ts                # 全ロール再エクスポート
├── profiles/                   # プロフィールフィールド設定 JSON
│   ├── index.ts                # 型定義エクスポート
│   └── {role}.profile.json     # hasProfile: true のロールのみ
├── types/                      # 型定義
│   ├── index.ts
│   ├── field.ts                # ProfileFieldConfig
│   ├── fieldTag.ts             # ProfileFieldTag
│   └── profileBase.ts          # ProfileBase インターフェース
├── utils/                      # ユーティリティ
│   ├── index.ts                # クライアント安全なエクスポートのみ
│   ├── schemaHelpers.ts        # Zodスキーマ操作 + バリデーション [共通]
│   ├── fieldHelpers.ts         # フィールド配列操作 [共通]
│   ├── configHelpers.ts        # プロフィール設定取得 [共通]
│   ├── createProfileBase.ts    # ProfileBase ファクトリ [サーバー専用]
│   └── profileBaseHelpers.ts   # レジストリヘルパー [サーバー専用]
├── services/server/            # サーバーサービス
│   ├── operations/             # 各操作の実装
│   │   ├── index.ts
│   │   ├── getProfile.ts
│   │   ├── upsertProfile.ts
│   │   ├── updateProfile.ts
│   │   ├── deleteProfile.ts
│   │   └── hasProfile.ts
│   └── userProfileService.ts   # 公開インターフェース
└── index.ts                    # ドメイン公開 API
```

## レジストリ（src/registry/）

プロフィール関連のレジストリは `src/registry/` に配置され、自動生成される。

| ファイル | 用途 | 環境 |
|---------|------|------|
| `profileConfigRegistry.ts` | role → ProfileConfig (UI用設定) | 共通 |
| `profileSchemaRegistry.ts` | role → Zod スキーマ | 共通 |
| `profileBaseRegistry.ts` | role → ProfileBase (CRUD) | サーバー |
| `profileTableRegistry.ts` | role → Drizzle テーブル | サーバー |

## 設定ファイル

### ロール設定（user ドメイン）

`src/features/core/user/roles/` にロール定義を配置。

```
roles/
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
      "placeholder": "株式会社〇〇"
    },
    {
      "name": "bio",
      "label": "自己紹介",
      "fieldType": "string",
      "formInput": "textarea"
    }
  ],
  "tags": {
    "registration": ["organization_name"],
    "selfEdit": ["organization_name", "bio"],
    "adminEdit": ["organization_name", "bio"]
  }
}
```

**tags の構造:**
- トップレベルにオブジェクトとして定義
- キー: タグ名（`registration`, `selfEdit`, `adminEdit`, `notification`）
- 値: そのタグに属するフィールド名の配列

## 自動生成ファイル

設定 JSON から以下が自動生成される（`role:generate` スクリプト）。

### generated/{role}/drizzle.ts

各ロールのプロフィールテーブル定義。

```typescript
export const contributorProfiles = pgTable("contributor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  organizationName: varchar("organization_name", { length: 255 }),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### generated/{role}/schema.ts

Zod バリデーションスキーマ。

```typescript
export const ContributorProfileSchema = z.object({
  organizationName: z.string().trim().min(1, {...}),
  bio: z.string().trim().nullish(),
});
```

## ユーティリティ

### クライアント/サーバー分離

| ファイル | 環境 | 用途 |
|---------|------|------|
| `utils/index.ts` | 共通 | クライアント安全なエクスポートのみ |
| `schemaHelpers.ts` | 共通 | Zodスキーマ操作 + バリデーション |
| `fieldHelpers.ts` | 共通 | フィールド配列操作（pickFieldsByTag, getFieldConfigsForForm） |
| `configHelpers.ts` | 共通 | プロフィール設定取得（getProfilesByCategory, getProfileConfig） |
| `createProfileBase.ts` | サーバー専用 | ProfileBase ファクトリ |
| `profileBaseHelpers.ts` | サーバー専用 | レジストリアクセス |

**重要**: サーバー専用ファイルは直接パスで import すること。

```typescript
// ❌ NG: クライアントコンポーネントでエラー
import { getProfileBase } from "../utils";

// ✅ OK: サーバーコンポーネント/サービスで直接 import
import { getProfileBase } from "../utils/profileBaseHelpers";
```

### schemaHelpers.ts（Zodスキーマ操作 + バリデーション）

```typescript
// ロールに対応するプロフィールスキーマを取得
getProfileSchema(role: string): z.ZodType | null

// スキーマから指定フィールドのみを抽出
pickSchemaByTag(schema: z.ZodObject, tagFields: string[]): z.ZodObject | null

// profileData のロール別・タグ別バリデーション関数を生成（superRefine用）
createProfileDataValidator(profiles: Record<string, ProfileConfig>, tag: string): ValidatorFn
```

### fieldHelpers.ts（フィールド配列操作）

```typescript
// フィールド配列から指定タグに属するフィールドを抽出
pickFieldsByTag(fields: ProfileFieldConfig[], tagFields: string[], excludeHidden?: boolean): ProfileFieldConfig[]

// プロフィールフィールドをフォーム用 FieldConfig に変換（Map形式）
// - プレフィックス追加: prefecture → profileData.prefecture
// - snake_case → camelCase 変換
getFieldConfigsForForm(profiles: Record<string, ProfileConfig>, role: string, options?: GetFieldConfigsForFormOptions): Map<string, FieldConfig>

// getFieldConfigsForForm の結果を配列で取得
getFieldConfigsForFormAsArray(profiles: Record<string, ProfileConfig>, role: string, options?: GetFieldConfigsForFormOptions): FieldConfig[]
```

### configHelpers.ts（プロフィール設定取得）

```typescript
// ロールカテゴリに属するプロフィール設定を取得
getProfilesByCategory(category: RoleCategory): Record<string, ProfileConfig>

// 指定ロールのプロフィール設定を取得
getProfileConfig(role: string): ProfileConfig | undefined
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

## フォームでの使用パターン

### 動的バリデーション（superRefine）

```typescript
// formEntities.ts
import { createProfileDataValidator, getProfilesByCategory } from "@/features/core/userProfile/utils";

// カテゴリからプロフィール設定を動的取得
const profiles = getProfilesByCategory("user");

// バリデーション関数生成
const validateProfileData = createProfileDataValidator(profiles, "adminEdit");

export const FormSchema = z
  .object({
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
    // ...
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });
```

### プロフィール設定ファイル

各フォームは `getProfilesByCategory()` を使用して動的にプロフィール設定を取得。

```typescript
// src/features/core/user/components/admin/form/generalUserProfiles.ts
import { getProfilesByCategory } from "@/features/core/userProfile/utils";

export const GENERAL_USER_PROFILES = getProfilesByCategory("user");
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
  selectableRoles={roles}         // 選択可能なロールを制限（オプション）
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
  profiles={profiles}             // ProfileConfig のマッピング
  tag="adminEdit"                  // 表示するタグ
  fieldPrefix="profileData"       // フィールド名プレフィックス
/>
```

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/features/core/user/roles/` | ロール設定 JSON |
| `src/features/core/user/constants/role.ts` | ロール派生定数 |
| `src/registry/profileConfigRegistry.ts` | ProfileConfig レジストリ |
| `src/registry/profileSchemaRegistry.ts` | Zod スキーマレジストリ |
| `src/registry/profileBaseRegistry.ts` | ProfileBase レジストリ |
| `src/registry/profileTableRegistry.ts` | Drizzle テーブルレジストリ |

## スクリプト

### role:generate

ロールとプロフィールの自動生成。

```bash
pnpm role:generate -- <roleId>
```

実行内容:
1. roleRegistry.ts 更新
2. generated/{roleId}/ 配下のファイル生成
3. profileSchemaRegistry.ts 更新
4. profileConfigRegistry.ts 更新
5. profileBaseRegistry.ts 更新
6. profileTableRegistry.ts 更新
