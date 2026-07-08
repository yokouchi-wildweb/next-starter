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
| `signupIp` | Text | 登録時 IP (referral / 管理画面が参照) |
| `metadata` | JSONB | 拡張メタデータ。`loginHistory` (直近ログイン履歴) 等を格納 |
| `deletedAt` | Timestamp | 論理削除日時 |
| `createdAt` | Timestamp | 作成日時 |
| `updatedAt` | Timestamp | 更新日時 |

> **IP データの所在に注意**: ログイン / サインアップの IP は `signupIp` 列・`metadata.loginHistory` (JSONB)・専用テーブル `user_login_events` の **3 箇所に併存** している。同一 IP のアカウント横断検索など IP 集計を行う場合は、JSONB をスキャンせず [`userLoginEvent` ドメイン](../userLoginEvent/README.md) の検索 API (`countDistinctUsersByIp` / `findUsersBySameIp` / `findUsersBySubnet`) を使うこと。併存の理由と移行方針は同 README を参照。

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

## プロフィール横断検索

ユーザー検索時に、プロフィールテーブルのフィールドも含めて横断検索できる。
テキスト横断検索（`searchQuery`）と構造化フィルタ（`profileWhere`）の 2 つの仕組みを提供。

### サーバー（SSR ページ / ServerService）

```typescript
import { userService } from "@/features/core/user/services/server/userService";

// テキスト横断検索
const result = await userService.searchWithProfile("contributor", {
  searchQuery: "田中",
  page: 1,
  limit: 20,
});

// プロフィールフィールドで構造化フィルタ
const result = await userService.searchWithProfile("contributor", {
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});

// 両方の組み合わせ
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

### クライアント（Hook）

```tsx
import { useSearchUserWithProfile } from "@/features/core/user/hooks/useSearchUserWithProfile";

const { data, total, isLoading } = useSearchUserWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});
```

### クライアント（サービス直接）

```typescript
import { userClient } from "@/features/core/user/services/client/userClient";

const result = await userClient.searchWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});
```

**パラメータ:**
- `searchQuery`: テキスト横断検索。ユーザーの `searchFields`（name, email 等）+ プロフィールの `searchFields` で ILIKE 検索（OR 結合）
- `profileWhere`: プロフィールフィールドの構造化フィルタ（`WhereExpr` DSL）。EXISTS サブクエリとして適用
- 両方指定時は AND 結合。いずれも未指定の場合は通常の `userService.search()` にフォールバック

> API エンドポイント: `GET /api/admin/user/search-with-profile?role=contributor&searchQuery=田中&profileWhere={"field":"prefecture","op":"eq","value":"東京都"}`
> 検索対象のプロフィールフィールドは `profile.json` の `searchFields` で設定する。`profileWhere` の DSL 詳細は `src/features/core/userProfile/README.md` を参照。

## ステータス遷移履歴（user_status_histories）

退会・休会・復帰・BAN 等のステータス遷移を恒久保存するサテライトテーブル。**常時オン**（設定フラグなし）。

### 設計方針

- users テーブルに分析用カラム（withdrawnAt 等）を追加しない方針の実装。関心事ごとのサテライトテーブル（USER_ACQUISITION と同じ前例）
- audit_logs とは責務が別: 監査ログはコンプライアンス用途で保持期限つき（既定365日で prune）、本テーブルは集計用途で恒久保存
- 記録は `recordStatusTransition()`（`services/server/statusHistory.ts`）に集約。`fromStatus === toStatus` は no-op

### スキーマ

| カラム | 型 | 説明 |
|--------|-----|------|
| `user_id` | uuid FK(users, cascade) | 対象ユーザー |
| `from_status` | user_status \| null | 遷移前。新規作成（INSERT）は null |
| `to_status` | user_status | 遷移後 |
| `trigger` | text | 遷移のきっかけ（語彙: `entities/model.ts` の `UserStatusTransitionTrigger`） |
| `changed_at` | timestamptz | 遷移日時 |

trigger 語彙: `self_withdraw` / `self_pause` / `self_reactivate` / `signup_pre_register` / `signup_activate` / `admin_change_status` / `admin_soft_delete` / `admin_restore` / `admin_create` / `demo_create` / `security_lockout`

### 集計レシピ

```typescript
// 日別退会数（本人退会 + 管理者削除）
import { sql } from "drizzle-orm";
import { UserStatusHistoryTable } from "@/features/core/user/entities/drizzle";

const rows = await db
  .select({
    day: sql<string>`date_trunc('day', ${UserStatusHistoryTable.changedAt})::date`,
    count: sql<number>`count(*)::int`,
  })
  .from(UserStatusHistoryTable)
  .where(eq(UserStatusHistoryTable.toStatus, "withdrawn"))
  .groupBy(sql`1`)
  .orderBy(sql`1`);
```

- デモユーザー除外は users への JOIN で `is_demo = false` を条件に加える
- ダッシュボードで重くなったら ANALYTICS_PERF（`withAnalyticsCache` → rollup）に載せる。単純 GROUP BY のうちは cache のみで十分

### 過去分のバックフィル

導入時に1回だけ実行（冪等・再実行安全）:

```bash
pnpm cron user-status-history-backfill
```

audit_logs に残っている `user.withdrew` / `user.status.changed` 等から復元する。監査ログの保持期限を過ぎて prune 済みの遷移は復元不可。

### 注意

**`users.status` を書き換える処理を新設したら、必ず `recordStatusTransition()` の呼び出しを追加すること。** 既存の記録箇所は `statusHistory.ts` の docstring を参照。

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/features/core/userProfile/` | ロール別プロフィール管理 |
| `src/registry/schemaRegistry.ts` | Drizzle スキーマ登録 |
| `src/lib/drizzle/` | Drizzle 設定 |
