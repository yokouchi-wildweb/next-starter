# userProfile ドメイン

ロール別プロフィールを管理するコアドメイン。
ロールに応じたプロフィールテーブルの CRUD・検索操作を統一的なインターフェースで提供する。

## 概要

- **役割**: ロール別プロフィールの統一管理
- **パターン**: Registry + Factory パターン
- **設定ファイル**: JSON 形式（1ロール1ファイル）
- **アクセス**: サーバー直接呼び出し + API ルート + クライアント hooks

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
├── hooks/                      # クライアント hooks
│   ├── index.ts                # 再エクスポート
│   ├── useProfile.ts           # プロフィールID で取得
│   ├── useProfileByUserId.ts   # userId で取得
│   ├── useProfileSearch.ts     # 検索
│   ├── useProfileUpdate.ts     # 更新（mutation）
│   ├── useProfileUpsert.ts     # upsert（mutation）
│   ├── useProfileDelete.ts     # 削除（mutation）
│   └── wrappers/               # ダウンストリーム用の型付きラッパー配置場所
│       └── README.md
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
├── services/
│   ├── client/                 # クライアントサービス
│   │   └── profileClient.ts    # プロフィール API クライアント
│   └── server/                 # サーバーサービス
│       ├── operations/         # 各操作の実装
│       │   ├── index.ts
│       │   ├── getProfile.ts
│       │   ├── upsertProfile.ts
│       │   ├── deleteProfile.ts
│       │   └── hasProfile.ts
│       └── userProfileService.ts   # 公開インターフェース
└── index.ts                    # ドメイン公開 API
```

## レジストリ（src/registry/）

プロフィール関連のレジストリは `src/registry/` に配置され、すべて全件再生成方式で自動生成される。

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
  "searchFields": ["bio", "organization_name"],
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

**searchFields（オプション）:**
- keyword 検索対象のカラム名を配列で指定（camelCase）
- `ProfileBase.search()` の `searchQuery` パラメータで使用される
- `userService.searchWithProfile()` でのプロフィール横断検索にも使用される
- 未指定の場合、keyword 検索は無効

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

## ProfileBase インターフェース

全ロールのプロフィールに対して統一的な CRUD・検索操作を提供。

```typescript
type ProfileBase = {
  // 基本 CRUD（createCrudService から継承）
  get: (id: string) => Promise<Record<string, unknown> | null>;
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  remove: (id: string) => Promise<void>;
  upsert: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;

  // 検索・一覧（createCrudService から継承）
  search: (params?: SearchParams & WithOptions & ExtraWhereOption) => Promise<PaginatedResult<Record<string, unknown>>>;
  list: (options?: WithOptions) => Promise<Record<string, unknown>[]>;
  query: <T>(baseQuery, options?, countQuery?) => Promise<PaginatedResult<T>>;

  // userId ベースの操作
  getByUserId: (userId: string) => Promise<Record<string, unknown> | null>;
  existsByUserId: (userId: string) => Promise<boolean>;
  updateByUserId: (userId: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  removeByUserId: (userId: string) => Promise<boolean>;
};
```

### createProfileBase オプション

```typescript
createProfileBase(table, {
  defaultSearchFields: ["bio", "organizationName"],  // keyword 検索対象カラム
});
```

`profile.json` に `searchFields` を記述すると、自動生成時に `profileBaseRegistry.ts` へ反映される。

### query() による自由な JOIN

`query()` を使うと、users テーブルとの JOIN など自由なクエリが組める。

```typescript
const profileBase = getProfileBase("contributor");
const baseQuery = db
  .select({
    profile: ContributorProfileTable,
    userName: UserTable.name,
  })
  .from(ContributorProfileTable)
  .leftJoin(UserTable, eq(ContributorProfileTable.userId, UserTable.id));

const result = await profileBase.query(baseQuery, { page: 1, limit: 20 });
```

## API ルート

プロフィール操作用の API ルートが `src/app/api/profile/[role]/` に配置されている。

| パス | メソッド | 機能 |
|------|---------|------|
| `/api/profile/[role]` | GET | 一覧取得 |
| `/api/profile/[role]/search` | GET | 検索 |
| `/api/profile/[role]/[id]` | GET | プロフィール ID で取得 |
| `/api/profile/[role]/[id]` | PATCH | プロフィール ID で更新 |
| `/api/profile/[role]/[id]` | DELETE | プロフィール ID で削除 |
| `/api/profile/[role]/upsert` | PUT | upsert |
| `/api/profile/[role]/by-user/[userId]` | GET | userId で取得 |
| `/api/profile/[role]/by-user/[userId]` | PATCH | userId で更新 |
| `/api/profile/[role]/by-user/[userId]` | DELETE | userId で削除 |

すべてのルートは `createApiRoute` で作成され、内部で `getProfileBase(role)` からサービスを取得する。
存在しないロールに対しては 404 を返す。

## クライアントサービス

`services/client/profileClient.ts` はロールをパラメータに取る汎用クライアント。

```typescript
import { profileClient } from "@/features/core/userProfile/services/client/profileClient";

// 検索
const result = await profileClient.search("contributor", {
  searchQuery: "田中",
  page: 1,
  limit: 20,
});

// userId で取得
const profile = await profileClient.getByUserId("contributor", userId);

// userId で更新
await profileClient.updateByUserId("contributor", userId, { bio: "新しい自己紹介" });

// upsert
await profileClient.upsert("contributor", { userId, bio: "自己紹介" });

// 削除（プロフィールIDで）
await profileClient.remove("contributor", profileId);

// 削除（userIdで）
await profileClient.removeByUserId("contributor", userId);
```

## hooks

クライアントコンポーネントから利用する汎用 hooks。ロールを第1引数に取る。

```typescript
import {
  useProfile,
  useProfileByUserId,
  useProfileSearch,
  useProfileUpdate,
  useProfileUpsert,
  useProfileDelete,
} from "@/features/core/userProfile/hooks";
```

| hook | 用途 | 引数 |
|------|------|------|
| `useProfile(role, id)` | プロフィール ID で取得 | role, id? |
| `useProfileByUserId(role, userId)` | userId で取得 | role, userId? |
| `useProfileSearch(role, params)` | 検索 | role, SearchParams |
| `useProfileUpdate(role)` | 更新 mutation | role |
| `useProfileUpsert(role)` | upsert mutation | role |
| `useProfileDelete(role)` | 削除 mutation | role |

### 使用例

```tsx
"use client";

import { useProfileSearch } from "@/features/core/userProfile/hooks";

function ContributorList() {
  const { data, total, isLoading } = useProfileSearch("contributor", {
    searchQuery: "田中",
    page: 1,
    limit: 20,
  });

  if (isLoading) return <div>読み込み中...</div>;
  return <div>{total}件のプロフィール</div>;
}
```

### 型付きラッパー（ダウンストリーム向け）

ベースの hooks・clientService・ProfileBase は すべて `Record<string, unknown>` 型で動作する。
これはロールが動的パラメータ（`role: string`）であり、汎用レイヤーでは具体型を静的に解決できないため。
ロール固有の型安全性が必要な場合は `hooks/wrappers/` に薄いラッパーを作成する。

```typescript
// hooks/wrappers/useContributorProfile.ts
import { useProfileByUserId } from "../useProfileByUserId";
import type { ContributorProfile } from "../../generated/contributor";

export const useContributorProfile = (userId?: string | null) => {
  const result = useProfileByUserId("contributor", userId);
  return {
    ...result,
    data: result.data as ContributorProfile | undefined,
  };
};
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
getFieldConfigsForForm(profiles: Record<string, ProfileConfig>, role: string, options?): Map<string, FieldConfig>

// getFieldConfigsForForm の結果を配列で取得
getFieldConfigsForFormAsArray(profiles: Record<string, ProfileConfig>, role: string, options?): FieldConfig[]
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

## サービス操作（サーバー専用）

プロフィールのサーバー操作は **2 つのエントリポイント** を用途に応じて使い分ける。

| 用途 | エントリポイント | 操作対象 |
|------|-----------------|----------|
| ユーザー単位の操作 | `userProfileService` | userId を指定した CRUD |
| テーブル全体の操作 | `getProfileBase(role)` | 検索・一覧・自由クエリ |

### userProfileService — userId 単位の操作

ユーザー作成/更新/削除と連動する文脈で使用する。

```typescript
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";

// プロフィール取得
userProfileService.getProfile(userId, role)

// プロフィール作成/更新（upsert）
userProfileService.upsertProfile(userId, role, data)

// プロフィール削除
userProfileService.deleteProfile(userId, role)

// プロフィール存在確認
userProfileService.hasProfile(userId, role)
```

### getProfileBase — テーブル全体の検索・一覧

SSR ページや管理画面でプロフィールを検索・一覧取得する場合はこちらを使用する。
`ProfileBase` は `createCrudService` から派生しており、search/list/query 等の汎用操作を提供する。

```typescript
import { getProfileBase } from "@/features/core/userProfile/utils/profileBaseHelpers";

const base = getProfileBase("contributor");

// 検索（ページネーション付き）
const result = await base.search({ searchQuery: "田中", page: 1, limit: 20 });

// 一覧取得
const all = await base.list();

// 自由クエリ（JOIN 等）
const joined = await base.query(baseQuery, { page: 1, limit: 20 });

// extraWhere: JSONB 検索や複雑な SQL 条件を追加（SSR 専用）
import { sql } from "drizzle-orm";
const result = await base.search({
  searchQuery: "田中",
  extraWhere: sql`${table.qualifications} @> '["TOEIC"]'::jsonb`,
});
```

> `getProfileBase` はサーバー専用。クライアントからは hooks（`useProfileSearch` 等）または API ルート経由でアクセスする。

> **extraWhere について**: `extraWhere` は Drizzle の `SQL` 型を直接受け取るため、API ルート（HTTP 経由）では使用できない。JSONB 検索や複雑な SQL 条件が必要な場合は、SSR ページから `getProfileBase` を直接呼び出すこと。

### ユーザー + プロフィール横断検索（userService.searchWithProfile）

ユーザーを検索する際に、プロフィールのフィールドも含めて横断検索したい場合は、ユーザードメイン側の `searchWithProfile` を使用する。

```typescript
import { userService } from "@/features/core/user/services/server/userService";

// テキスト横断検索
const result = await userService.searchWithProfile("contributor", {
  searchQuery: "田中",
  page: 1,
  limit: 20,
});

// プロフィールフィールドで構造化フィルタ（WhereExpr DSL）
const result = await userService.searchWithProfile("contributor", {
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});

// テキスト検索 + 構造化フィルタの組み合わせ
const result = await userService.searchWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: {
    and: [
      { field: "prefecture", op: "eq", value: "東京都" },
      { field: "age", op: "gte", value: 20 },
    ],
  },
  page: 1,
  limit: 20,
});
```

**動作:**
- `searchQuery`: ユーザーテーブルの `searchFields`（`domain.json`）+ プロフィールの `searchFields`（`profile.json`）で ILIKE 横断検索（OR 結合）
- `profileWhere`: プロフィールフィールドの構造化フィルタ（`WhereExpr` DSL）。EXISTS サブクエリとして AND 結合
- `searchQuery` と `profileWhere` は独立して機能し、両方指定すれば AND 結合
- いずれも未指定の場合は通常の `userService.search()` にフォールバック

**クライアントからの利用:**

```typescript
// クライアントサービス
import { userClient } from "@/features/core/user/services/client/userClient";
const result = await userClient.searchWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});

// Hook
import { useSearchUserWithProfile } from "@/features/core/user/hooks/useSearchUserWithProfile";
const { data, total, isLoading } = useSearchUserWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});
```

> API エンドポイント: `GET /api/admin/user/search-with-profile?role=contributor&searchQuery=田中&profileWhere={"field":"prefecture","op":"eq","value":"東京都"}`
> `profileWhere` は JSON 文字列として渡す。`WhereExpr` DSL の演算子: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `like`, `in`, `notIn`。`and` / `or` で複合条件を組める。
> プロフィール管理の CRUD 検索には引き続き `getProfileBase(role).search()` を使用する。

## フォームでの使用パターン

### 動的バリデーション（superRefine）

```typescript
// formEntities.ts
import { createProfileDataValidator, getProfilesByCategory } from "@/features/core/userProfile/utils";

const profiles = getProfilesByCategory("user");
const validateProfileData = createProfileDataValidator(profiles, "adminEdit");

export const FormSchema = z
  .object({
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });
```

## コンポーネント

### RoleSelector

ロール選択 UI。カテゴリ指定、入力タイプ（select/radio）切り替え可能。

```tsx
<RoleSelector
  control={control}
  name="role"
  categories={["user"]}
  selectableRoles={roles}
  inputType="radio"
  radioDisplayType="standard"
  showDescription
/>
```

### RoleProfileFields

ロールに応じたプロフィールフィールドを動的レンダリング。

```tsx
<RoleProfileFields
  methods={methods}
  role={selectedRole}
  profiles={profiles}
  tag="adminEdit"
  fieldPrefix="profileData"
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
| `src/app/api/profile/[role]/` | プロフィール API ルート |

## スクリプト

### role:generate

ロールとプロフィールの自動生成。

```bash
pnpm role:generate -- <roleId>
```

実行内容:
1. roleRegistry.ts 更新
2. generated/{roleId}/ 配下のファイル生成
3. profileSchemaRegistry.ts 全件再生成
4. profileConfigRegistry.ts 全件再生成
5. profileBaseRegistry.ts 全件再生成（searchFields 反映）
6. profileTableRegistry.ts 全件再生成
