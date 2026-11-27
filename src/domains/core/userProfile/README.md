# userProfile ドメイン

## Overview

- ロール別プロフィールを管理するコアドメイン。ロールに応じたプロフィールテーブルの CRUD・検索操作を統一的なインターフェースで提供する
- パターン: Registry + Factory。設定は JSON（1 ロール 1 ファイル）
- アクセス: サーバー直接呼び出し + API ルート + クライアント hooks
- 決まり（上書きの形・メディア項目・入口の使い分け・import の仕方・extraWhere・URL の名前・型付きラッパー・タグ）は札 `.claude/rules/items/domains/userProfile.md`

## Usage

### サービス操作（サーバー専用）

プロフィールのサーバー操作は **2 つのエントリポイント** を用途に応じて使い分ける。

| 用途 | エントリポイント | 操作対象 |
|------|-----------------|----------|
| ユーザー単位の操作 | `userProfileService` | userId を指定した CRUD |
| テーブル全体の操作 | `getProfileBase(role)` | 検索・一覧・自由クエリ |

#### URL の項目

- URL を持つ項目（キー名の末尾が `Url`）は、`upsertProfile`(作成・更新の共通の通り道。`/api/me/profile`・管理画面・デモユーザーの作成のどれもここを通る)が、値が空でなければ `http://` / `https://` だけを通し、ほかのスキーム(`javascript:` 等)と URL として読めない値を 400 にする(`isSafeHttpUrl`、`@/utils/url`)
- ただし `/api/profile/[role]/**`(管理者用)の PATCH / PUT は ProfileBase を直に呼ぶので、この検査を通らない
- 理由: 画面で href に渡るため、クライアントの検証を迂回した stored XSS をサーバーで止める。プロフィールの定義(profile.json)に URL の入力の種類はまだ無い

#### userProfileService — userId 単位の操作

ユーザー作成/更新/削除と連動する文脈で使用する。

```typescript
import { userProfileService } from "@/domains/core/userProfile/services/server/userProfileService";

// プロフィール取得
userProfileService.getProfile(userId, role)

// プロフィール作成/更新（upsert）
userProfileService.upsertProfile(userId, role, data)

// プロフィール削除
userProfileService.deleteProfile(userId, role)

// プロフィール存在確認
userProfileService.hasProfile(userId, role)
```

#### getProfileBase — テーブル全体の検索・一覧

SSR ページや管理画面でプロフィールを検索・一覧取得する場合はこちらを使用する。
`ProfileBase` は `createCrudService` から派生しており、search/list/query 等の汎用操作を提供する。

```typescript
import { getProfileBase } from "@/domains/core/userProfile/utils/profileBaseHelpers";

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

> `getProfileBase` はサーバー専用。クライアントからは hooks（`useProfileSearch` 等。ルートは管理者だけ）を使う。

> **extraWhere について**: `extraWhere` は Drizzle の `SQL` 型を直接受け取るため、API ルート（HTTP 経由）では使えない。

#### ユーザー + プロフィール横断検索（userService.searchWithProfile）

ユーザーを検索する際に、プロフィールのフィールドも含めて横断検索したい場合は、ユーザードメイン側の `searchWithProfile` を使用する。

```typescript
import { userService } from "@/domains/core/user/services/server/userService";

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
- `searchQuery`: ユーザーテーブルの `searchFields`（登録の `entities/user/entity.json`）+ プロフィールの `searchFields`（`profile.json`）で ILIKE 横断検索（OR 結合）
- `profileWhere`: プロフィールフィールドの構造化フィルタ（`WhereExpr` DSL）。EXISTS サブクエリとして AND 結合
- `searchQuery` と `profileWhere` は独立して機能し、両方指定すれば AND 結合
- いずれも未指定の場合は通常の `userService.search()` にフォールバック

**クライアントからの利用:**

```typescript
// クライアントサービス
import { userClient } from "@/domains/core/user/services/client/userClient";
const result = await userClient.searchWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});

// Hook
import { useSearchUserWithProfile } from "@/domains/core/user/hooks/useSearchUserWithProfile";
const { data, total, isLoading } = useSearchUserWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});
```

> API エンドポイント: `GET /api/admin/user/search-with-profile?role=contributor&searchQuery=田中&profileWhere={"field":"prefecture","op":"eq","value":"東京都"}`
> `profileWhere` は JSON 文字列として渡す。`WhereExpr` DSL の演算子: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `like`, `startsWith`, `endsWith`, `in`, `notIn`, `isNull`, `isNotNull`。`and` / `or` で複合条件を組める。

### クライアントサービス

`services/client/profileClient.ts` はロールをパラメータに取る汎用クライアント。
共通の CRUD(`getAll` / `get` / `update` / `search` / `upsert` / `delete`)は crud の `createApiClient`(`/api/profile/<role>`)に任せ、
プロフィールにしかない操作(`getByUserId` / `updateByUserId` / `deleteByUserId`、`/api/profile/<role>/by-user/<userId>`)だけを持つ。
失敗はどれも `normalizeHttpError` を通した `HttpError` で投げる。

UI（コンポーネント・Screen）からは直接呼ばず、下の「hooks」節のフック（`useProfileSearch` など）を使う（lint `client-service-boundary/no-direct-import` が検出する）。以下はフックを実装する側の呼び方。

```typescript
import { profileClient } from "@/domains/core/userProfile/services/client/profileClient";

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
await profileClient.delete("contributor", profileId);

// 削除（userIdで）
await profileClient.deleteByUserId("contributor", userId);
```

### hooks

クライアントコンポーネントから利用する汎用 hooks。ロールを第1引数に取る。

```typescript
import {
  useProfile,
  useProfileByUserId,
  useProfileSearch,
  useProfileUpdate,
  useProfileUpsert,
  useProfileDelete,
} from "@/domains/core/userProfile/hooks";
```

| hook | 用途 | 引数 |
|------|------|------|
| `useProfile(role, id)` | プロフィール ID で取得 | role, id? |
| `useProfileByUserId(role, userId)` | userId で取得 | role, userId? |
| `useProfileSearch(role, params)` | 検索 | role, SearchParams |
| `useProfileUpdate(role)` | 更新 mutation | role |
| `useProfileUpsert(role)` | upsert mutation | role |
| `useProfileDelete(role)` | 削除 mutation | role |

#### 使用例

```tsx
"use client";

import { InlineLoader } from "@/components/Overlays/Loading";
import { Para } from "@/components/TextBlocks/Para";
import { useProfileSearch } from "@/domains/core/userProfile/hooks";

function ContributorList() {
  const { data, total, isLoading } = useProfileSearch("contributor", {
    searchQuery: "田中",
    page: 1,
    limit: 20,
  });

  if (isLoading) return <InlineLoader />;
  return <Para>{total}件のプロフィール</Para>;
}
```

#### 型付きラッパー

ベースの hooks・clientService・ProfileBase は すべて `Record<string, unknown>` 型で動作する。
これはロールが動的パラメータ（`role: string`）であり、汎用レイヤーでは具体型を静的に解決できないため。
ロール固有の型安全性が必要な場合は薄いラッパーを作成する。Tier1 のロールは `hooks/wrappers/`、fork のロールは自分のドメインの `hooks/`(fork は `src/domains/core/` にファイルを足せない)。例は `hooks/wrappers/README.md`。

### フォームでの使用パターン

#### 動的バリデーション（superRefine）

```typescript
// formEntities.ts
import { createProfileDataValidator, getProfilesByCategory } from "@/domains/core/userProfile/utils";

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

### コンポーネント

#### RoleSelector

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

#### RoleProfileFields

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

## API

- 一覧（extensions/）・ProfileBase インターフェース・API ルート・ユーティリティは `API.md`

## Extension

### 設定ファイル

#### ロール設定（user ドメイン）

`src/domains/core/user/coreRoles/` に core ロール、`roles/` に追加ロールの定義を配置（`src/domains/core/user/README.md`）。

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

#### プロフィールフィールド設定（userProfile ドメイン）

`hasProfile: true` のロールのみ、対応する設定ファイルを配置。

**{role}.profile.json の構造:**
```json
{
  "roleId": "contributor",
  "searchFields": ["bio", "organizationName"],
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
- キー: タグ名（`registration`, `selfEdit`, `adminEdit`, `notification`）。タグの値の正は `constants/fieldTags.mjs`（知らないタグは pnpm generate role が止める）
- 値: そのタグに属するフィールド名の配列（fields の name か relations の fieldName。無い名前は pnpm generate role が止める）

**searchFields（オプション）:**
- keyword 検索対象のカラム名を配列で指定（camelCase。fields の name は snake_case だが searchFields は列のプロパティ名）
- `ProfileBase.search()` の `searchQuery` パラメータで使用される
- `userService.searchWithProfile()` でのプロフィール横断検索にも使用される
- 未指定の場合、keyword 検索は無効

**メディア項目（mediaUploader）は無い:**
- プロフィールのテーブル（createProfileBase）はファイル台帳への紐付け（createCrudService の `storage` オプション）に対応していない。上げたファイルが業務行に紐付かず、掃除 cron で消える
- そのため profile.json に mediaUploader / mediaCollection の項目があると `pnpm generate role`（forge）の検査が止める
- 代わりの置き場は札 no_media_fields

#### リレーション設定

`profile.json` に `relations` を追加することで、プロフィールテーブルにリレーションを設定できる。
フォーマットは登録の entity.json の `relations` と同じ。

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
    }
  ]
}
```

**対応するリレーションタイプ:**
- `belongsTo`: 外部キーカラムを生成。`onDelete` で削除時の挙動を指定
- `belongsToMany`: 今は書けない（生成が止まる）。多対多の結びはいつも自分の登録（D354）で、core の userProfile の表の横に fork の結びの登録を置く場所がまだ無い（使うリポは無い）

**自動生成される内容:**
- `drizzle.ts`: FK カラム（belongsTo）
- `schema.ts`: FK フィールドの Zod バリデーション
- `model.ts`: FK フィールドの型定義
- `extensions/profileBases.ts`: `createProfileBase` に `belongsToManyRelations`, `belongsToRelations`, `belongsToManyObjectRelations`, `countableRelations` を渡す

**書き方:** role.json・profile.json は手で書き（対話で組み立てるコマンドは無い）、`pnpm forge` で生成する。リレーションの決まり（belongsTo だけ、fieldName 必須、fieldType は省略か uuid、SET_NULL は required と両立しない、formInput）は生成前の検査が止める（下の「pnpm generate role」）。

### fork の上書き

fork は上流の JSON を書き換えず、隣に上書きのファイルを 1 本置く。値を変えるだけで、表の形（fields・relations）は変えられない。

| ファイル | 書けるキー |
|---------|-----------|
| `user/roles/<id>.role.override.ts`（追加ロール） | `label`・`hasProfile`・`enabled` |
| `user/coreRoles/<id>.role.override.ts`（core ロール） | `label`・`hasProfile` |
| `userProfile/profiles/<role>.profile.override.ts` | `tags`・`searchFields`・`audit`（値は丸ごと置き換え） |

```typescript
// src/domains/core/user/coreRoles/user.role.override.ts
import type { CoreRoleOverride } from "../types";

export const override: CoreRoleOverride = { hasProfile: true };
```

- 実行せず字面で読む（書ける形は札 override_literal）
- 未知キー・値の型違い・隣に JSON の無い上書きは `pnpm generate role` と forge の事前検査が止める。空（空白とコメントだけ）と不在は上書きなし
- 上流は上書きを持てない（`pnpm check extensions`）。下の Tier は同じファイルを書き換える
- `pnpm generate role -- --toggle` は上書きが `enabled` を決めていると止まる。`pnpm generate role -- --delete-profile`・`pnpm generate role -- --delete` は上書きが `hasProfile` を決めていると止まる（`--remove-json` の `pnpm generate role -- --delete` は上書きごと消す）

### 監査ログ

`profile.json` か上書きに `audit` を書くと `extensions/profileBases.ts` の `createProfileBase` に渡る。書き方は `src/domains/core/auditLog/README.md`「A」。`updateByUserId` は `base.update` を通るので監査に残る。`deleteByUserId` は残らない。

## Internals

### 自動生成ファイル

設定 JSON から以下が自動生成される（`pnpm generate role` スクリプト）。

#### entities/profiles/{role}/drizzle.ts

各ロールのプロフィールテーブル定義。

```typescript
export const ContributorProfileTable = pgTable("contributor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => UserTable.id, { onDelete: "cascade" }),
  organizationName: varchar("organization_name", { length: 255 }),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

#### entities/profiles/{role}/schema.ts

Zod バリデーションスキーマ。

```typescript
export const ContributorProfileSchema = z.object({
  organizationName: z.string().trim().min(1, {...}),
  bio: z.string().trim().nullish(),
});
```


#### pnpm generate role

ロールとプロフィールの自動生成。

```bash
pnpm generate role -- <roleId>
pnpm generate role -- --all      # 全 *.role.json（user/extensions/roles.ts の今の並び順で回す）
```

書く前に検査する（`scripts/structure/role/checks/`、テスト `pnpm test scripts/structure/role/tests/checks.test.mjs`）。問題は全件並べて何も書かずに終了コード 1、`--all` は全ロールを先に検査する:
- 止める（ロール）: ロール ID の形（英小文字で始まる英小文字・数字・_）、ファイル名（`<id>.role.json`）、`isCore` のキー、core ロールの置き場（`roles/` に core の ID、`coreRoles/` に 3 つ以外）、category（user / admin）、hasProfile（boolean、true ならプロフィール設定が要る）
- 止める（プロフィール）: ロール設定の無いプロフィール設定（`--all` のとき）、項目 0 件、メディア型（mediaUploader / mediaCollection）、enum の選択肢・既定値の型（ドメインの検査と同じ）、知らないタグ・tags の無い名前、型の表に無い fieldType（`hasProfile: true` のとき）、項目のキー `default`（既定値は `defaultValue`）
- 止める（リレーション・上書き・監査）: relationType（belongsTo だけ。belongsToMany は結びの置き場が無いので止める）・fieldName・fieldType（省略か uuid）・onDelete の値・SET_NULL × required・formInput、上書きの問題（「fork の上書き」）、audit の形（auditLog の README「A」）
- 警告だけ: hasProfile: false なのにプロフィール設定がある（プロフィールの生成物は消さずに残す。消すのは `pnpm generate role -- --delete-profile`）、型と入力欄の組が表（`src/lib/domain/fields/fieldFormInputs.mjs` の Neon）に無い、選択肢の要る入力欄に options が無い

実行内容:
1. user/extensions/roles.ts 更新
2. entities/profiles/{roleId}/ 配下のファイル生成（relations があれば FK カラムも生成）
3. extensions/ の 4 本を全件再生成（searchFields・リレーション設定・audit を反映）

#### 操作コマンド

既定は対話なし（引数で決める）。`-i` のときだけ今までの対話。ロール・プロフィールを作る・項目を足すのは JSON を手で書いて `pnpm forge`。

```bash
pnpm generate role -- --profile <roleId>                    # プロフィールだけ生成（--all = プロフィールのある全ロール）
pnpm generate role -- --delete-profile <roleId> --confirm <roleId>   # プロフィールの生成物と登録を消す（--keep-generated / --remove-json）
pnpm generate role -- --delete <roleId> --confirm <roleId>   # ロールを消す（同上）
pnpm generate role -- --toggle <roleId> --on|--off           # 有効 / 無効（反転は -i）
pnpm check role -- --list
```

### entities/profiles/package.json

`entities/profiles/package.json` の `"sideEffects": false` は、client が `entities/profiles/<role>` の入口からスキーマだけを読むときに、同じ入口の `drizzle.ts`(表の定義と列名)を bundle へ入れないための印。消すと公開ページの client chunk に列名が届く(検査: `pnpm check bundle`)。

## Related

- ロール設定 JSON: `src/domains/core/user/coreRoles/`・`roles/`（`src/domains/core/user/README.md`）
- ロール派生定数: `src/domains/core/user/constants/role.ts`
- ロールの一覧（生成物）: `src/domains/core/user/extensions/roles.ts`
- プロフィール API ルート: `src/app/api/profile/[role]/`
- 型付きラッパーの例: `hooks/wrappers/README.md`
