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
       ↓ pnpm db:push
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
pnpm db:push
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
| `localPassword` | Text | ローカル認証用パスワードハッシュ（**秘匿カラム**、下記参照） |
| `status` | Enum | ステータス |
| `isDemo` | Boolean | デモユーザーフラグ |
| `lastAuthenticatedAt` | Timestamp | 最終認証日時 |
| `signupIp` | Text | 登録時 IP (referral / 管理画面が参照) |
| `metadata` | JSONB | 拡張メタデータ。`loginHistory` (直近ログイン履歴) 等を格納 |
| `deletedAt` | Timestamp | 論理削除日時 |
| `createdAt` | Timestamp | 作成日時 |
| `updatedAt` | Timestamp | 更新日時 |

> **秘匿カラム（localPassword）**: `entities/drizzle.ts` の `defineHiddenColumns(UserTable, ["localPassword"])` 宣言により、`userService`（createCrudService）の全戻り値・他ドメインの `withRelations` 展開で **常に null 化** され、API レスポンスに乗ることはない。サーバー内部でハッシュを読む正規経路は `services/server/finders/findByIdWithSecrets.ts`（ID 指定・削除済み含む）と `findByLocalEmail.ts`（ローカルログイン用）の 2 つの直接 drizzle ファインダーのみ。これらの戻り値を HTTP レスポンスに乗せることは厳禁。仕組みの詳細は `src/lib/crud/README.md` の hiddenColumns 節を参照。
>
> **パスワード変更の契約（`newPassword`）**: `userService.update(id, { newPassword })` は **プロバイダー非依存の「このユーザーのパスワードをこれにする」** 契約。UI（`AdminUserManageModal` 認証タブ等）は保存先を知らず、`services/server/helpers/passwordChange.ts` の `planPasswordChange` がサーバー側で振り分ける: `local` → `localPassword` としてスキーマ入力にマージ（hash 変換・ロックアウトカウンタリセット・全セッション失効は既存経路がそのまま動く）| `email` → Firebase Auth へ同期 | それ以外（OAuth/OIDC/SAML 等）→ **DomainError 400**（パスワード経路が無いのに成功を返す「無言 no-op」を禁止）。`localPassword` を直接渡す旧経路も引き続き有効。回帰テスト: `pnpm test:user-password-change`。
>
> **IP データの所在に注意**: ログイン / サインアップの IP は `signupIp` 列・`metadata.loginHistory` (JSONB)・専用テーブル `user_login_events` の **3 箇所に併存** している。同一 IP のアカウント横断検索など IP 集計を行う場合は、JSONB をスキャンせず [`userLoginEvent` ドメイン](../userLoginEvent/README.md) の検索 API (`countDistinctUsersByIp` / `findUsersBySameIp` / `findUsersBySubnet`、端末受け渡し検出は `findSessionHandoffsByUser` / `findSessionHandoffsByIp`) を使うこと。明示ログアウト (logout / pause / withdraw) も同テーブルに `logout` 行として入る。併存の理由と移行方針は同 README を参照。

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
pending, active, inactive, suspended, banned, security_locked, withdrawn
```

定義元は `constants/status.ts` の `USER_STATUSES`（意味は [ユーザーステータス](#ユーザーステータス) を参照）。

## ユーザーステータス

ユーザーのビジネス上の状態は `users.status` 1列で一元管理する（ラベルは `USER_STATUS_LABELS`）。

| ステータス | ラベル | 意味 | 主な遷移元 |
|-----------|--------|------|-----------|
| `pending` | 仮登録 | 認証プロバイダ側の登録は済んだが本登録（プロフィール入力等）前 | 新規サインアップ / `withdrawn` からの再入会（`registration/preRegisterFromAuth.ts`） |
| `active` | 有効 | 通常利用可能 | `pending`・`withdrawn` から本登録（`registration/activate.ts`）、`inactive` から復帰（`reactivate.ts`） |
| `inactive` | 休会中 | ユーザー自身による一時休止 | `active` から本人操作（`pause.ts`） |
| `suspended` | 処分保留 | 管理者による一時的な利用制限（復帰可能） | 管理者のステータス変更 |
| `banned` | 永久追放 | 規約違反等による恒久的な利用停止 | 管理者のステータス変更 |
| `security_locked` | セキュリティロック | 不正ログイン試行の検知等によるロック | ローカルログインのロックアウト（`wrappers/lockoutPolicy.ts`）等 |
| `withdrawn` | 退会済み | 退会済み（再サインアップで `pending` に戻り再入会できる） | `active` から本人退会（`withdraw.ts`）、管理者のソフトデリート |

### ステータスグループ（`constants/status.ts`）

| 定数 | 値 | 用途 |
|------|-----|------|
| `USER_AVAILABLE_STATUSES` | `active` | サービス利用可能 = ログイン済みとして扱うステータス。`authGuard` の `allowStatuses` 既定値、API の認可（`requireRole` / `apiAccess`）が参照 |
| `USER_REGISTERED_STATUSES` | `active` / `inactive` / `suspended` / `banned` / `security_locked` | 本登録済み = 再登録不可。サインアップ時の既存ユーザー判定（`auth/services/server/registration.ts`）が参照 |

「利用不可」グループは `!USER_AVAILABLE_STATUSES.includes(status)` で表現できるため定義しない。

`active` 以外でログインした場合の扱いは画面側の `authGuard` が `statusRedirects` で振り分ける（`(user)/(protected)/layout.tsx`: `inactive` → `/reactivate`、`suspended` / `banned` / `security_locked` → `/restricted`、`pending` / `withdrawn` → ログアウトしてサインアップへ）。ログイン時点で拒否されるステータスの詳細は auth ドメインの `localLogin.ts` / `firebaseSession.ts` を参照。

ステータス遷移の記録は [ステータス遷移履歴](#ステータス遷移履歴user_status_histories)、操作の監査は audit_logs（`user.withdrew` / `user.status.changed` 等）が担う。

## バリデーションスキーマ

`entities/schema.ts` で Zod スキーマを定義。

| スキーマ | 用途 |
|---------|------|
| `UserCoreSchema` | 全フィールドの基本スキーマ |
| `UserOptionalSchema` | 更新用（フィールドをオプショナル化） |
| `UserUpdateByAdminSchema` | 管理者による更新用 |
| `UserSelfUpdateSchema` | ユーザー自身による更新用 |

## 表示名 = ユーザー名（バリデーションと一意性）

`users.name` の仕様。マイページ等の UI ラベルでは「ユーザー名」、コード・スキーマ上は「表示名 (display name)」
と呼んでいるが同一フィールドを指す。「ユーザー名の重複禁止」を検討している場合はこのセクションが該当する。

設定: `src/config/app/user-name.config.ts`（`USER_NAME_CONFIG`）

### バリデーション（常時適用）

共有スキーマ `entities/userName.ts` を全書き込み経路（サインアップ・本登録・マイページ・管理画面）で使用する。
デモユーザーの作成経路（`createDemoUser` / `createGuestDemoUser` / `scripts/db/seed/data/demoUser.ts`）は
`isDemo = true` で一意性の判定スコープ外のため、一意性ガードを通さない（意図した設計）。

| スキーマ | 用途 |
|---------|------|
| `UserNameSchema` | 必須の経路（サインアップ `RegistrationSchema`、本登録 `UserActivationSchema`） |
| `UserNameNullishSchema` | エンティティ側の任意フィールド（`UserCoreSchema.name`。空文字は null に正規化） |
| `UserNameFormSchema` | react-hook-form 用（空文字 = クリアを許容、文字列のまま検証） |

ルール: trim + `maxLength`（既定 30、設定で調整）+ 制御文字/改行/ゼロ幅文字の拒否。
表示名のルールを変える場合は `userName.ts` だけを変更すれば全経路に反映される。

### 一意性（オプトイン、既定は重複許容）

`USER_NAME_CONFIG.unique.enabled: true` で表示名の重複を禁止できる。DB の unique 制約ではなく
**アプリケーションレイヤ**（`services/server/helpers/nameAvailability.ts`）で検証する。

- 判定スコープ: `deleted_at IS NULL` かつ `is_demo = false`（退会済み・デモユーザーは名前を占有しない）
- `caseInsensitive: true`（既定）で大文字小文字を同一視。正規化ロジックは
  `utils/userName.ts` の `normalizeUserNameForComparison` に一元化
- check→write 間の同時実行レースは `pg_advisory_xact_lock`（正規化名キー）で直列化して排除
- 検索は expression index `users_name_norm_idx`（`lower(btrim(name))`、unique 制約ではない）が受ける
- 違反時は `DomainError` 409「この表示名は既に使用されています」

検証が入る書き込みポイント（`withUserNameGuard` / `assertUserNameAvailable`）:

| 経路 | 実装 |
|------|------|
| サインアップ本登録・再入会 | `registration/activate.ts` |
| マイページ・管理画面の更新 | `wrappers/update.ts`（name 変更時と、デモ → 通常（`isDemo` true→false）の切替時） |
| 管理画面からのユーザー作成 | `creation/console/createGeneralUser.ts` / `createAdmin.ts` |
| 管理画面からの再登録（名前指定あり） | `creation/console/restore.ts`（衝突時 409） |
| 汎用 restore（`/api/user/[id]/restore`） | `wrappers/restore.ts`（衝突時はブロックせず「名前_2」等へ自動付替。候補名もロックしてから判定） |

ガードを通らない一括書き込み・複製系（`upsert` / `bulkUpsert` / `bulkUpdate` / `bulkUpdateByIds` /
`replaceByQuery` / `duplicate`）は `userService` から公開しない。汎用 `/api/user/**` の該当ルートは 404、
CSV インポートも拒否される（`domain.json` も `useImportExport: false`）。サービス内部で必要な場合は
`base` を直接使い、表示名・ステータス履歴の整合は呼び出し側で担保する。

テスト: `pnpm test:user-name-availability`（DB 不要な判定ロジックのみ。同時実行の直列化と SQL の判定スコープは対象外）

一括判定が必要な場合（候補名リストのフィルタリング等）は `isUserNamesTaken(names[]) => Set<使用中の入力文字列>`
を使う（単一クエリ + 同一の判定条件。`isUserNameTaken` はこの単発版）。

### 予約名（users テーブル外の名前を一意性チェックに参加させる）

ボット・NPC・合成ランキングエントリなど「実ユーザーの隣に表示される非ユーザー名」や、
「運営」「admin」等の予約語を実ユーザーに取らせたくない場合は、
`src/registry/reservedUserNamesRegistry.ts` にプロバイダを登録する（上流は空 = 挙動変化なし）。

```ts
// 例: 静的な予約語リスト
export const RESERVED_USER_NAME_PROVIDERS: readonly ReservedUserNameProvider[] = [
  {
    key: "static-reserved-words",
    filterReserved: async (names) => names.filter((n) => ["運営", "admin", "公式"].includes(n)),
  },
];
```

- `filterReserved(normalizedNames, ctx)` は「渡された正規化済み名前のうち予約済みのもの」を返す。
  比較対象は `normalizeUserNameForComparison` と同じ正規化（trim + caseInsensitive 時は小文字化）で保持すること
- users スキャンで空きだった名前についてのみ照会される。サフィックス採番
  （restore 衝突・dedup）も予約名を自動回避する
- **プロバイダは高速なローカル DB 参照に限る。** advisory lock を保持したトランザクション内で
  呼ばれるため、遅いプロバイダは同名サインアップの直列化待ちを伸ばす。
  外部 API 等の遅い I/O は事前にテーブルへ同期しておくこと
- `ctx.executor` が渡された場合、Drizzle 参照はそれを使う（ガードと同一トランザクションで読むため）

### 有効化手順（運用途中の切り替え）

1. `unique.enabled: true` に変更してデプロイ（以後の新規書き込みから検証開始）
2. 既存の重複を確認: `pnpm task user-name-dedup -- --dry-run`
3. 既存の重複を解消: `pnpm task user-name-dedup`
   - 各グループで `createdAt` 最古のユーザーが元の名前を保持し、他は「名前_2」「名前_3」…に自動リネーム
   - リネームは `base.update` 経由のため audit_logs に記録される
   - 冪等・one-shot（定期実行しない）

DB 制約を使わないため、既存データに重複があっても有効化がブロックされることはない
（有効化〜解消完了までの間、既存重複はそのまま残り、新規の書き込みだけが検証される）。

#### 有効化時の注意

- **リネームされたユーザーへの通知は組み込まれていない。** dedup は audit_logs に記録を残すが、
  本人向けの通知（「表示名が変更されました」等）は行わない。必要なら dry-run の結果
  （`renamed` の userId 一覧）をもとに `messagingService.send / bulkSend` で通知するのは
  ダウンストリームの責務
- **セッション JWT の name クレームは古いまま残る。** リネーム後、DB 参照
  （`requireCurrentUser` 経由）の画面は即反映されるが、JWT クレームの name を表示に
  使っている箇所は再ログインまで旧名が見える（実害は表示のみ）

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
   pnpm db:push
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

## 退会と削除

### 2 段階削除（ソフトデリート → 物理削除）

| 操作 | 実装 | 内容 |
|------|------|------|
| 本人退会 | `withdraw.ts`（`active` のみ可） | status を `withdrawn` に変更 + クリーンアップ + 監査ログ `user.withdrew`（1 トランザクション）。行は残る。アバターなどのファイルも残す |
| ソフトデリート（管理者） | `wrappers/softDelete.ts` / `POST /api/admin/user/[userId]/delete` | `deleted_at` 設定 + status を `withdrawn` に変更 + クリーンアップ + 監査ログ `user.soft_deleted`（1 トランザクション）。ファイルは残す（復元できるように） |
| 復元 | `wrappers/restore.ts`（汎用 `/api/user/[id]/restore`） | `deleted_at` を戻す（表示名衝突時は自動サフィックス） |
| 物理削除（管理者） | `wrappers/hardDelete.ts` / `DELETE /api/admin/user/[userId]/hard-delete` | 削除前のユーザー情報全体を `before` に入れた監査ログ `user.hard_deleted` を記録 → user カテゴリなら Firebase Auth も削除 → DB 行を物理削除（アバターの実物も消える）→ その人の未使用のアップロードを取り消す |

物理削除を分けている理由:

- 管理画面の通常一覧から外す用途（ソフトデリート）と、DB から消す用途（物理削除）を分離し、誤操作による完全削除を防ぐ。ソフトデリートは復元可能な猶予期間として機能する
- 物理削除が必要なのは、開発・QA・審査・デモ用アカウントの後始末や、GDPR 等の削除要求・法的命令といった限られたケース

> 物理削除の前にソフトデリートを経ることはコード上強制していない（`hardDelete` は削除済み・未削除どちらの行も対象にする）。「削除済み一覧から復元 or 完全削除」する画面構成は上流に同梱していないため、必要ならダウンストリームで用意する。

物理削除後に残るもの / 消えるもの:

- 残る: `audit_logs`（`target_id` は text で FK なし。物理削除時の全情報も `user.hard_deleted` の `before` に残る）、`wallet_histories`（`user_id` に FK なし）
- 消える: `user_status_histories` など `users` に `onDelete: "cascade"` で FK を張っているテーブル
- ファイル（[storageObject README](../storageObject/README.md)「規則」のユーザーの物理削除）
  - 消える: アバター（同じ TX で台帳から外し、commit 後に実物）、その人がアップロードしてまだどこにも紐付いていないファイル、cascade で消える表のファイル（振込明細の画像など。掃除 cron の照合が後で消す。経理で残すなら物理削除せず退会・ソフトデリートを使う）
  - 残る: 他の業務行に紐付いたファイル、チャットの添付など他の人のデータが参照しうるファイル
  - 公開の用途の画像は、消してもブラウザ・CDN のキャッシュに残りうる

### 退会時のクリーンアップハンドラ（userCleanupRegistry）

退会・ソフトデリート時に、他ドメインのリソース後始末を実行する仕組み。

```
src/registry/userCleanupRegistry.ts           ← ハンドラの登録（UserCleanupHandler 型もここ）
services/server/executeCleanup.ts             ← 実行エンジン
```

- `withdraw.ts` / `wrappers/softDelete.ts` の両方がトランザクション内で `executeCleanup(userId, tx)` を呼ぶ
- ステータス変更（`withdrawn` への更新）はレジストリの責務外。呼び出し元が自前で行う（softDelete は `setStatusWithdrawn`）

| 種類 | 失敗時の挙動 | 上流の登録 |
|------|-------------|-----------|
| `requiredHandlers` | 例外をそのまま投げ、トランザクション全体（ステータス変更・監査ログ含む）をロールバック | `clearWalletBalance`（全ウォレットの balance / locked_balance を 0 にクリア + 履歴記録） |
| `optionalHandlers` | `console.error` に記録して続行 | `cancelPendingPurchaseRequests`（pending / processing の購入リクエストを expired に。onExpire を持つ purchase_type は per-row でフック呼び出し） |

いずれも記載順に逐次実行され、required → optional の順。

**ハンドラの追加手順**

1. 対象ドメインの `services/server/` に `UserCleanupHandler` 型 `(userId: string, tx: DbTransaction) => Promise<void>` の関数を作る
   - DB 操作は必ず渡された `tx` で行う（独自にトランザクションを開始しない）
2. `src/registry/userCleanupRegistry.ts` の `requiredHandlers` か `optionalHandlers` に追加する

```typescript
// src/features/<domain>/services/server/cleanupOnWithdraw.ts
import type { DbTransaction } from "@/lib/crud/drizzle/types";

export async function cleanupOnWithdraw(userId: string, tx: DbTransaction): Promise<void> {
  // userId に紐づくリソースを tx で後始末する
}
```

**required / optional の判断基準**

- 失敗したときにデータ不整合が起きる → `required`（例: 残高・ポイントのクリア）
- 失敗しても許容できるベストエフォート → `optional`（例: 通知送信、外部 API への連携通知）
- 未処理リクエストのキャンセルのような中間的なものはケースバイケース。**迷ったら `required`**（データ整合性を優先）

> optional でも、ハンドラ内の SQL が失敗すると PostgreSQL のトランザクション自体が aborted 状態になり、後続の処理（監査ログ記録等）も失敗して結局ロールバックされる（`executeCleanup` は SAVEPOINT を張らない）。DB 書き込みの失敗まで許容したい optional ハンドラは、内部の DB 操作を `tx.transaction(...)`（ネストトランザクション = SAVEPOINT）で囲むこと。

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
pnpm task user-status-history-backfill
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
