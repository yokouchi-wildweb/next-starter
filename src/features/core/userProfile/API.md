# userProfile ドメイン — API

## Overview

- `README.md` の API の節を分けた文書（一覧・ProfileBase・API ルート・ユーティリティ）
- 使い方は `README.md` の Usage、決まりは札 `.claude/rules/items/features/userProfile.md`

## API

### 一覧（extensions/）

プロフィールの一覧は `extensions/` にあり、`pnpm generate role` が全件を書き直す。ロールの一覧は `src/features/core/user/extensions/roles.ts`。

| ファイル | 用途 | 環境 |
|---------|------|------|
| `profileConfigs.ts` | role → ProfileConfig (UI用設定) | 共通 |
| `profileSchemas.ts` | role → Zod スキーマ | 共通 |
| `profileBases.ts` | role → ProfileBase (CRUD) | サーバー |
| `profileTables.ts` | role → Drizzle テーブル | サーバー |

### ProfileBase インターフェース

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

#### createProfileBase オプション

```typescript
// 基本（searchFields のみ）
createProfileBase(table, {
  defaultSearchFields: ["bio", "organizationName"],
});

// リレーション付き
createProfileBase(ContributorProfileTable, {
  defaultSearchFields: ["bio"],
  belongsToRelations: [
    { field: "contributorCategory", foreignKey: "contributorCategoryId", table: ContributorCategoryTable },
  ],
  belongsToManyRelations: [
    {
      fieldName: "contributorTagIds",
      throughTable: ContributorProfileToContributorTagTable,
      sourceColumn: ContributorProfileToContributorTagTable.contributorProfileId,
      targetColumn: ContributorProfileToContributorTagTable.contributorTagId,
      sourceProperty: "contributorProfileId",
      targetProperty: "contributorTagId",
    },
  ],
  belongsToManyObjectRelations: [
    {
      field: "contributor_tags",
      targetTable: ContributorTagTable,
      throughTable: ContributorProfileToContributorTagTable,
      sourceColumn: ContributorProfileToContributorTagTable.contributorProfileId,
      targetColumn: ContributorProfileToContributorTagTable.contributorTagId,
    },
  ],
  countableRelations: [
    { field: "contributor_tags", throughTable: ContributorProfileToContributorTagTable, foreignKey: "contributorProfileId" },
  ],
});
```

`profile.json` に `searchFields` や `relations` を記述すると、自動生成時に `extensions/profileBases.ts` へ反映される。
リレーションを設定すると `search()` / `list()` で `withRelations` / `withCount` オプションが使用可能になる。

#### query() による自由な JOIN

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

### API ルート

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

### ユーティリティ

#### クライアント/サーバー分離

| ファイル | 環境 | 用途 |
|---------|------|------|
| `utils/index.ts` | 共通 | クライアント安全なエクスポートのみ |
| `schemaHelpers.ts` | 共通 | Zodスキーマ操作 + バリデーション |
| `fieldHelpers.ts` | 共通 | フィールド配列操作（pickFieldsByTag, getFieldConfigsForForm） |
| `configHelpers.ts` | 共通 | プロフィール設定取得（getProfilesByCategory, getProfileConfig） |
| `createProfileBase.ts` | サーバー専用 | ProfileBase ファクトリ |
| `profileBaseHelpers.ts` | サーバー専用 | レジストリアクセス |


#### schemaHelpers.ts（Zodスキーマ操作 + バリデーション）

```typescript
// ロールに対応するプロフィールスキーマを取得
getProfileSchema(role: string): z.ZodType | null

// スキーマから指定フィールドのみを抽出
pickSchemaByTag(schema: z.ZodObject, tagFields: string[]): z.ZodObject | null

// profileData のロール別・タグ別バリデーション関数を生成（superRefine用）
createProfileDataValidator(profiles: Record<string, ProfileConfig>, tag: string): ValidatorFn
```

#### fieldHelpers.ts（フィールド配列操作）

```typescript
// フィールド配列から指定タグに属するフィールドを抽出
pickFieldsByTag(fields: ProfileFieldConfig[], tagFields: string[], excludeHidden?: boolean): ProfileFieldConfig[]

// プロフィールフィールドをフォーム用 FieldConfig に変換（Map形式）
getFieldConfigsForForm(profiles: Record<string, ProfileConfig>, role: string, options?): Map<string, FieldConfig>

// getFieldConfigsForForm の結果を配列で取得
getFieldConfigsForFormAsArray(profiles: Record<string, ProfileConfig>, role: string, options?): FieldConfig[]
```

#### configHelpers.ts（プロフィール設定取得）

```typescript
// ロールカテゴリに属するプロフィール設定を取得
getProfilesByCategory(category: RoleCategory): Record<string, ProfileConfig>

// 指定ロールのプロフィール設定を取得
getProfileConfig(role: string): ProfileConfig | undefined
```

#### profileBaseHelpers.ts（サーバー専用）

```typescript
// プロフィールを持つロールの一覧
PROFILE_ROLES: string[]

// ロールがプロフィールを持つか確認
hasProfileBase(role: string): boolean

// ロールに対応する ProfileBase を取得
getProfileBase(role: string): ProfileBase | null
```
