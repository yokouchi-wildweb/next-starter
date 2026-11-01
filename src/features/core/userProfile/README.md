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
│   ├── fieldTags.mjs           # フィールドタグの値（正。role:generate の検査も読む）
│   └── fieldTag.ts             # fieldTags.mjs を型付きで再 export
├── entities/profiles/{role}/   # 自動生成ファイル [DO NOT EDIT]
│   ├── drizzle.ts              # Drizzle テーブル定義
│   ├── schema.ts               # Zod スキーマ
│   ├── form.ts                 # フォーム型定義
│   ├── model.ts                # モデル型定義
│   ├── presenters.ts           # プレゼンター
│   └── index.ts
├── extensionPoints.ts          # 一覧の宣言（writer: "role:generate"）
├── extensions/                 # 一覧 [DO NOT EDIT]（下の「一覧」）
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
│   ├── {role}.profile.json     # hasProfile: true のロールのみ
│   └── {role}.profile.override.ts # fork の上書き（下の「fork の上書き」）
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

## 一覧（extensions/）

プロフィールの一覧は `extensions/` にあり、`pnpm role:generate` が全件を書き直す。ロールの一覧は `src/features/core/user/extensions/roles.ts`。

| ファイル | 用途 | 環境 |
|---------|------|------|
| `profileConfigs.ts` | role → ProfileConfig (UI用設定) | 共通 |
| `profileSchemas.ts` | role → Zod スキーマ | 共通 |
| `profileBases.ts` | role → ProfileBase (CRUD) | サーバー |
| `profileTables.ts` | role → Drizzle テーブル | サーバー |

## 設定ファイル

### ロール設定（user ドメイン）

`src/features/core/user/coreRoles/` に core ロール、`roles/` に追加ロールの定義を配置（`src/features/core/user/README.md`）。

```
coreRoles/
├── admin.role.json         # core ロール
├── user.role.json
└── debugger.role.json
roles/
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
  "hasProfile": true
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
- キー: タグ名（`registration`, `selfEdit`, `adminEdit`, `notification`）。タグを足す・消すときは `constants/fieldTags.mjs` を編集する（知らないタグは role:generate が止める）
- 値: そのタグに属するフィールド名の配列（fields の name か relations の fieldName。無い名前は role:generate が止める）

**searchFields（オプション）:**
- keyword 検索対象のカラム名を配列で指定（camelCase）
- `ProfileBase.search()` の `searchQuery` パラメータで使用される
- `userService.searchWithProfile()` でのプロフィール横断検索にも使用される
- 未指定の場合、keyword 検索は無効

**メディア項目（mediaUploader）は使えない:**
- プロフィールのテーブル（createProfileBase）はファイル台帳への紐付け（createCrudService の `storage` オプション）に対応していない。上げたファイルが業務行に紐付かず、掃除 cron で消える
- そのため profile.json に mediaUploader / mediaCollection の項目があると `role:generate`（forge）の検査が止める
- プロフィールに画像が要る場合は、用途を登録した別ドメインの列に置くか、プロフィールの binding 対応を upstream に依頼する（/order <上流リポ>）

### リレーション設定

`profile.json` に `relations` を追加することで、プロフィールテーブルにリレーションを設定できる。
フォーマットは `domain.json` の `relations` と同じ。

```json
{
  "roleId": "contributor",
  "fields": [...],
  "relations": [
    {
      "domain": "contributor_category",
      "label": "カテゴリ",
      "fieldName": "contributor_category_id",
      "fieldType": "uuid",
      "relationType": "belongsTo",
      "required": false,
      "onDelete": "RESTRICT",
      "formInput": "asyncCombobox"
    },
    {
      "domain": "contributor_tag",
      "label": "タグ",
      "fieldName": "contributor_tag_ids",
      "fieldType": "uuid",
      "relationType": "belongsToMany",
      "includeRelationTable": true,
      "formInput": "asyncMultiSelect"
    }
  ]
}
```

**対応するリレーションタイプ:**
- `belongsTo`: 外部キーカラムを生成。`onDelete` で削除時の挙動を指定
- `belongsToMany`: 中間テーブルを自動生成（`{RoleId}ProfileTo{Relation}Table`）

**自動生成される内容:**
- `drizzle.ts`: FK カラム（belongsTo）、中間テーブル（belongsToMany）
- `schema.ts`: FK フィールドの Zod バリデーション
- `model.ts`: FK フィールドの型定義
- `extensions/profileBases.ts`: `createProfileBase` に `belongsToManyRelations`, `belongsToRelations`, `belongsToManyObjectRelations`, `countableRelations` を渡す

**書き方:** role.json・profile.json は手で書き（対話で組み立てるコマンドは無い）、`pnpm forge` で生成する。リレーションの決まり（belongsTo / belongsToMany だけ、fieldName 必須、fieldType は省略か uuid、SET_NULL は required と両立しない、formInput）は生成前の検査が止める（下の「role:generate」）。

## fork の上書き

fork は上流の JSON を書き換えず、隣に上書きのファイルを 1 本置く。値を変えるだけで、表の形（fields・relations）は変えられない。

| ファイル | 書けるキー |
|---------|-----------|
| `user/roles/<id>.role.override.ts`（追加ロール） | `label`・`hasProfile`・`enabled` |
| `user/coreRoles/<id>.role.override.ts`（core ロール） | `label`・`hasProfile` |
| `userProfile/profiles/<role>.profile.override.ts` | `tags`・`searchFields`・`audit`（値は丸ごと置き換え） |

```typescript
// src/features/core/user/coreRoles/user.role.override.ts
import type { CoreRoleOverride } from "../types";

export const override: CoreRoleOverride = { hasProfile: true };
```

- 実行せず字面で読む。書けるのは `import type`（相対パス）と `export const override = { … }` だけで、値はリテラルにする
- 未知キー・値の型違い・隣に JSON の無い上書きは `role:generate` と forge の事前検査が止める。空（空白とコメントだけ）と不在は上書きなし
- 上流は上書きを持てない（`extensions:check`）。下の Tier は同じファイルを書き換える
- `role:toggle` は上書きが `enabled` を決めていると止まる。`prof:delete`・`role:delete` は上書きが `hasProfile` を決めていると止まる（`--remove-json` の `role:delete` は上書きごと消す）

## 監査ログ

`profile.json` か上書きに `audit` を書くと `extensions/profileBases.ts` の `createProfileBase` に渡る。書き方は `src/features/core/auditLog/README.md`「A」。`updateByUserId` は `base.update` を通るので監査に残る。`removeByUserId` は残らない。

## 自動生成ファイル

設定 JSON から以下が自動生成される（`role:generate` スクリプト）。

### entities/profiles/{role}/drizzle.ts

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

### entities/profiles/{role}/schema.ts

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

UI（コンポーネント・Screen）からは直接呼ばず、下の「hooks」節のフック（`useProfileSearch` など）を使う（lint `client-service-boundary/no-direct-import` が検出する）。以下はフックを実装する側の呼び方。

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
import type { ContributorProfile } from "../../entities/profiles/contributor";

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

### URL の項目(名前の決まり)

- URL を持つ項目は `<name>Url`(キー名の末尾を `Url`)と名付ける。`upsertProfile`(作成・更新の共通の通り道。`/api/me/profile`・管理画面・デモユーザーの作成のどれもここを通る)が、その値が空でなければ `http://` / `https://` だけを通し、ほかのスキーム(`javascript:` 等)と URL として読めない値を 400 にする(`isSafeHttpUrl`、`@/utils/url`)
- 理由: 画面で href に渡るため、クライアントの検証を迂回した stored XSS をサーバーで止める。プロフィールの定義(profile.json)に URL の入力の種類はまだ無い(足すのは後の作業)

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

// extraWhere: 配列の列（text[]）の検索や複雑な SQL 条件を追加（SSR 専用）
import { arrayContains } from "drizzle-orm";
const result = await base.search({
  searchQuery: "田中",
  extraWhere: arrayContains(table.qualifications, ["TOEIC"]),
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
| `src/features/core/user/coreRoles/`・`roles/` | ロール設定 JSON |
| `src/features/core/user/constants/role.ts` | ロール派生定数 |
| `src/features/core/user/extensions/roles.ts` | ロールの一覧（生成物） |
| `src/features/core/userProfile/extensions/` | プロフィールの一覧（生成物） |
| `src/app/api/profile/[role]/` | プロフィール API ルート |

## スクリプト

### role:generate

ロールとプロフィールの自動生成。

```bash
pnpm role:generate -- <roleId>
pnpm role:generate -- --all      # 全 *.role.json（user/extensions/roles.ts の今の並び順で回す）
```

書く前に検査する（`scripts/role-config/checks/`、テスト `pnpm test:role-config-checks`）。問題は全件並べて何も書かずに終了コード 1、`--all` は全ロールを先に検査する:
- 止める: ロール ID の形（英小文字で始まる英小文字・数字・_）、ファイル名（`<id>.role.json`）、`isCore` のキー、core ロールの置き場（`roles/` に core の ID、`coreRoles/` に 3 つ以外）、category（user / admin）、hasProfile（boolean、true ならプロフィール設定が要る）、ロール設定の無いプロフィール設定（`--all` のとき）、項目 0 件、メディア型（mediaUploader / mediaCollection）、enum の選択肢・既定値の型（ドメインの検査と同じ）、知らないタグ・tags の無い名前、リレーションの relationType（belongsTo / belongsToMany）・fieldName・fieldType（省略か uuid）・onDelete の値・SET_NULL × required・formInput、上書きの問題（「fork の上書き」）、audit の形（auditLog の README「A」）
- 警告だけ: hasProfile: false なのにプロフィール設定がある（プロフィールの生成物は消さずに残す。消すのは `prof:delete`）、型と入力欄の組が表（`scripts/domain-config/spec/formInputs.mjs` の Neon）に無い、選択肢の要る入力欄に options が無い

実行内容:
1. user/extensions/roles.ts 更新
2. entities/profiles/{roleId}/ 配下のファイル生成（relations があれば FK カラム・中間テーブルも生成）
3. extensions/ の 4 本を全件再生成（searchFields・リレーション設定・audit を反映）

### 操作コマンド

既定は対話なし（引数で決める）。`-i` のときだけ今までの対話。ロール・プロフィールを作る・項目を足すのは JSON を手で書いて `pnpm forge`。

```bash
pnpm prof:generate <roleId>                    # プロフィールだけ生成（--all = プロフィールのある全ロール）
pnpm prof:delete <roleId> --confirm <roleId>   # プロフィールの生成物と登録を消す（--keep-generated / --remove-json）
pnpm role:delete <roleId> --confirm <roleId>   # ロールを消す（同上）
pnpm role:toggle <roleId> --on|--off           # 有効 / 無効（反転は -i）
pnpm role:list
```

## entities/profiles/package.json

`entities/profiles/package.json` の `"sideEffects": false` は、client が `entities/profiles/<role>` の入口からスキーマだけを読むときに、同じ入口の `drizzle.ts`(表の定義と列名)を bundle へ入れないための印。消すと公開ページの client chunk に列名が届く(検査: `pnpm test:client-chunks`)。
