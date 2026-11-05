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
├── coreRoles/            # core ロール admin・user・debugger の JSON（消せない・無効にできない）
├── roles/                # 追加ロールの JSON
├── extensions/roles.ts   # ロールの一覧（pnpm role:generate が書く）
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

1 ロール 1 ファイルで定義。ファイル名は `<id>.role.json`。

```
coreRoles/                # core ロール（上流の 3 つだけ。削除・無効化は不可）
├── admin.role.json
├── user.role.json
└── debugger.role.json
roles/                    # 追加ロール
├── editor.role.json
└── contributor.role.json
```

- `role:delete`・`role:toggle` は core ロールで止まる。`roles/` に core と同じ ID、`coreRoles/` に 3 つ以外のファイル、`isCore` を書いた JSON は `role:generate` と forge の事前検査で止まる
- fork が core ロールで変えられるのは `label`・`hasProfile` だけ（`coreRoles/<id>.role.override.ts`、`src/features/core/userProfile/README.md`「fork の上書き」）

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

| フィールド | 説明 |
|-----------|------|
| `id` | ロール識別子（DB に保存される値） |
| `label` | UI 表示名 |
| `category` | `"admin"` or `"user"`（管理画面での分類） |
| `description` | 説明文 |
| `hasProfile` | プロフィールテーブルを持つか |

### 2. ロール読み込み

`pnpm role:generate`（forge が回す）が `extensions/roles.ts` に一覧を書き、`constants` が `ALL_ROLES` として再 export する。手で直さない。

一覧の並びは DB の enum `user_role` の順そのもの（`entities/drizzle.ts`）。生成は今の並びを保ち、新しいロールを末尾に足す。

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
> **更新の入口**: `userService.update(id, data)` = 認可済みの呼び手用（汎用 API は管理者限定、サーバー内の処理。管理者のスキーマで検証し、セッションは読まない）。`userService.updateSelf(actor, data)` = 本人用（`actor` は route の `ctx.user`。本人のスキーマ、非管理者のローカル認証は 400）。利用者の入力を渡す route は必ず `updateSelf`。
>
> **検証の失敗**: スキーマが書いた文はそのまま返し、Zod の既定の文（"Invalid url" など）は `src/config/app/user-update.config.ts` の固定文に置き換える。失敗した項目の path と code だけを server にログ（値は出さない）。
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
| `USER_AVAILABLE_STATUSES` | `active` | サービス利用可能 = ログイン済みとして扱うステータス。ページの守り(guard.ts / createLoader)の `allowStatuses` 既定値、API の Factory の認可（`apiAccess` の evaluateApiAccessRule、`allowStatuses` の既定値）が参照 |
| `USER_REGISTERED_STATUSES` | `active` / `inactive` / `suspended` / `banned` / `security_locked` | 本登録済み = 再登録不可。サインアップ時の既存ユーザー判定（`auth/services/server/registration.ts`）が参照 |

「利用不可」グループは `!USER_AVAILABLE_STATUSES.includes(status)` で表現できるため定義しない。

`active` 以外でログインした場合の扱いは範囲の守りの `statusRedirects` が振り分ける（`(user)/(protected)/guard.ts`: `inactive` → `/reactivate`、`suspended` / `banned` / `security_locked` → `/restricted`、`pending` / `withdrawn` → ログアウトしてサインアップへ）。ログイン時点で拒否されるステータスの詳細は auth ドメインの `localLogin.ts` / `firebaseSession.ts` を参照。

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

外から来た名前（サインインプロバイダーの表示名など）を表示名にするときは `sanitizeUserName(raw)` で整える
（使用できない文字の除去 + trim + `maxLength` で切る。空文字になりうる。一意性は見ないので保存は `withUserNameGuard` を通す）。
禁止文字の一覧を fork 側で持ち直さない。

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
| 外部の認証の身元からの作成・再登録 | `registration/createFromProvider.ts`（衝突時はブロックせず「名前_2」等へ自動付替。候補名もロックしてから判定） |

ガードを通らず行を作る一括書き込み・複製系（`upsert` / `bulkUpsert` / `replaceByQuery` / `duplicate`）は
`userService` から公開しない。汎用 `/api/user/**` の該当ルートは 404、CSV インポートも拒否される
（`domain.json` も `useImportExport: false`）。サービス内部で必要な場合は `base` を直接使い、表示名・
ステータス履歴の整合は呼び出し側で担保する。

一括削除（`bulkDeleteByIds` / `bulkDeleteByQuery`）も `softDelete` のステータス変更・クリーンアップ・監査ログを
通らないため `userService` から公開しない。汎用の `/api/user/bulk/delete-by-ids` と `/api/user/bulk/delete-by-query` は
404（権限のない呼び出しは先に 401 / 403）。複数のユーザーを消すときは 1 人ずつ `softDelete` を呼ぶ。

単体の削除 `userService.remove`（汎用 `DELETE /api/user/:id`・`useDeleteUser`）は `softDelete` と同じ処理を通す
（`wrappers/remove.ts`）。削除済みのユーザーは 400、存在しないユーザーは 404。

### 一括更新

管理者が複数ユーザーをまとめて更新する経路。列の性質で使い分ける。

| 更新したいもの | 経路 | 動作 |
|------|------|------|
| タグを足す / 外す（既存のタグは残す） | `useBulkAddUserTags` / `useBulkRemoveUserTags` の `trigger(userIds, tagIds)` | 1 文の SQL。再追加は何もしない |
| `adminMemo`、タグの置き換え | `useBulkUpdateByIdsUser`（同じ値）/ `useBulkUpdateUser`（行ごとに違う値） | `base` の一括更新。全件成功か全件失敗か |
| `status` / `role` | 1 人ずつ `useChangeUserStatus` / `useChangeUserRole` | 一括の経路は無い |
| `name` / `email` / `phoneNumber` / パスワード | 1 人ずつ `useUpdateUser` | 一括の経路は無い |

- 認可: 汎用 API の `ADMIN_ONLY`（管理者のみ）
- 許可する列: `src/config/app/user-bulk-update.config.ts` の `USER_BULK_UPDATE.fields`。それ以外の列は黙って捨てず 400。副作用のある列（上の表の下 2 行、`isDemo`）は足さない
- 上限: 1 回 1000 ユーザー（超えたら 400）。タグの追加・削除はタグ 50 件まで。超える分はクライアントで分割して送る
- タグの追加・削除の結果: `{ count, affectedIds, unknownIds, unknownTargetIds }`（`unknownTargetIds` = 存在しないタグ）。存在しない id（追加では論理削除済みも）はエラーにせず飛ばして返す
- 監査: タグの追加・削除は変わったユーザーごとに `user.relation.added` / `user.relation.removed`（metadata に `field` と `targetIds`）。変化が無ければ記録しない
- `enableUserTag` を切った fork ではタグの表が無いので、タグの経路を呼ばない

画面: 管理一覧の一括操作は受け口 `adminBulkActions/` の項目で出す（`src/lib/tableSuite/README.md`「一括操作の受け口」）。上流の既定は一般ユーザーの一覧のタグの一括設定（`adminBulkActions/userTags.tsx`、置き換え）。追加だけの操作が要る fork は自分の項目を足す:

```tsx
// src/features/core/user/adminBulkActions/addUserTags.tsx（fork の項目）
export const bulkAction: UserAdminBulkActionItem = bulkRelationAction(
  { key: "addUserTags", lists: ["general"], order: 20 },
  { domain: userDisplay, relation: "userTag", mode: "add", label: "タグを追加" },
);
```

足りないタグをその場で作るときは `useCreateUserTag` の `trigger` を `onCreateOption` から呼ぶ（書き方: `src/lib/crud/components/Buttons/README.md`）。

自前の UI なら `useBulkAddUserTags` の `trigger` を `ChecklistPopover` の `onConfirm` から呼ぶ。

テスト: `pnpm test:user-name-availability`（DB 不要な判定ロジックのみ。同時実行の直列化と SQL の判定スコープは対象外）

一括判定が必要な場合（候補名リストのフィルタリング等）は `isUserNamesTaken(names[]) => Set<使用中の入力文字列>`
を使う（単一クエリ + 同一の判定条件。`isUserNameTaken` はこの単発版）。

### 予約名（users テーブル外の名前を一意性チェックに参加させる）

ボット・NPC・合成ランキングエントリなど「実ユーザーの隣に表示される非ユーザー名」や、
「運営」「admin」等の予約語を実ユーザーに取らせたくない場合は、
`src/features/core/user/reservedNames/<名前>.ts` に `export const provider` を置き `pnpm extensions:generate`（上流は項目 0 = 挙動変化なし）。

```ts
// 例: 静的な予約語リスト
export const provider: ReservedUserNameProvider = {
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
  （loader の ctx.user・`requireUserRecord` 経由）の画面は即反映されるが、JWT クレームの name を表示に
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
     "hasProfile": false
   }
   ```

2. **hasProfile: true の場合** `userProfile/profiles/{role}.profile.json` を作成

3. **生成と DB スキーマ反映**（`user/extensions/roles.ts` と生成物は forge が書く）
   ```bash
   pnpm forge
   pnpm db:push
   ```

fork が上流のロールの `label`・`hasProfile`・`enabled` を変えるときは JSON を書き換えず、隣に `<JSON の名前>.override.ts` を置く（`src/features/core/userProfile/README.md`「fork の上書き」）。

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
| ソフトデリート（管理者） | `wrappers/softDelete.ts` / `POST /api/admin/user/[userId]/delete`（汎用 `DELETE /api/user/:id` = `wrappers/remove.ts` も同じ） | `deleted_at` 設定 + status を `withdrawn` に変更 + クリーンアップ + 監査ログ `user.soft_deleted`（1 トランザクション）。ファイルは残す（復元できるように） |
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

### 退会時のクリーンアップハンドラ（拡張点 cleanupHandlers）

退会・ソフトデリート時に、他ドメインのリソース後始末を実行する仕組み。

```
cleanupHandlers/<名前>.ts      ← 項目（export const handler: UserCleanupItem）
extensions/cleanupHandlers.ts                 ← 一覧（生成物、pnpm extensions:generate）
services/server/cleanup.ts                    ← 項目の型と実行（必須 → 任意）
services/server/executeCleanup.ts             ← 呼び手の入口
```

- `withdraw.ts` / `wrappers/softDelete.ts` の両方がトランザクション内で `executeCleanup(userId, tx)` を呼ぶ
- ステータス変更（`withdrawn` への更新）は項目の責務外。呼び出し元が自前で行う（softDelete は `setStatusWithdrawn`）

| 種類 | 失敗時の挙動 | 上流の登録 |
|------|-------------|-----------|
| `requiredHandlers` | 例外をそのまま投げ、トランザクション全体（ステータス変更・監査ログ含む）をロールバック | `clearWalletBalance`（全ウォレットの balance / locked_balance を 0 にクリア + 履歴記録） |
| `optionalHandlers` | `console.error` に記録して続行 | `cancelPendingPurchaseRequests`（pending / processing の購入リクエストを expired に。onExpire を持つ purchase_type は per-row でフック呼び出し） |

`required: true` → `false` の順に、それぞれファイル名の順で逐次実行する。`enabled` が false の項目は走らない（機能が無効ならテーブルが無い場合があるため。閉じられる機能を import する項目は必須、`test:feature-gate`）。

**ハンドラの追加手順**

1. 対象ドメインの `services/server/` に `UserCleanupHandler` 型 `(userId: string, tx: DbTransaction) => Promise<void>` の関数を作る
   - DB 操作は必ず渡された `tx` で行う（独自にトランザクションを開始しない）
2. `src/features/core/user/cleanupHandlers/<名前>.ts` に項目を置き `pnpm extensions:generate`:
   `export const handler: UserCleanupItem = { required: true, enabled: () => <フラグ>, run: cleanupOnWithdraw };`

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

## 外部の認証の身元から作る口（createFromProvider）

新しい認証手段（fork の LINE ログインなど）で、外部の身元 `(providerType, providerUid)` から有効な利用者を引く・作る公開の口。
名前の規則・状態の履歴・ログインの記録・監査を写さずに済ませる。使い方の全体（身元の確認 → この口 → `establishSession`）は
[auth README「新しい認証手段」](../auth/README.md#新しい認証手段身元の確認--createfromprovider--establishsession)。

```ts
import { userService } from "@/features/core/user/services/server/userService";

const { user, isNewUser, isRejoin } = await userService.createFromProvider({
  providerType: "line",     // USER_PROVIDER_TYPES の値
  providerUid: lineUserId,  // プロバイダー側の利用者 ID
  displayName,              // プロバイダーの表示名（名前の規則を通す）
  ip,                       // signupIp とログインの記録 signup（省略可）
  role,                     // 省略 = REGISTRATION_DEFAULT_ROLE（assertRoleEnabled）
  tx,                       // 呼び手の tx（省略 = 自分で 1 つ開く）
});
```

| 見つかった行 | すること | 戻り値 |
|------|------|------|
| なし | 新規作成: `active`・`email` null・`isDemo` false・`signupIp` → 状態の履歴 `null → active`（`signup_activate`）→ 監査 `user.registered` → tx の後にログインの記録 `signup` | `isNewUser: true` |
| `pending` | 本登録と同じく `active` に（状態の履歴 `signup_activate`・監査 `user.registered`） | `isNewUser: false` |
| `withdrawn` | 上流の再登録の規則で `active` に（`signupIp`・状態の履歴 `signup_activate`・監査 `user.rejoined`・ログインの記録 `signup`） | `isRejoin: true` |
| その他（`active`・`inactive`・`suspended`・`security_locked` など） | 何も変えずに返す（判断は `establishSession` の状態の分岐） | `isNewUser: false` |

- 名前: `sanitizeUserName(displayName)`、空なら既定名 `PROVIDER_USER_DEFAULT_NAME`（「ユーザー」）。`USER_NAME_CONFIG.unique.enabled` のとき
  `lockUserName` の後に使用中（予約名を含む）か見て、使用中なら `findAvailableSuffixedUserName`（「名前_2」…）。無効のときはそのまま（他の作成の道と同じ規則）
- tx: 書き込み（引く・名前・作成または有効化・状態の履歴・監査）は 1 つの tx の中の savepoint で行う。呼び手の tx を渡せばそこで一緒に確定・巻き戻しする
- 同時に 2 回来て `(provider_type, provider_uid)` の unique 違反になったら savepoint だけ巻き戻して引き直し、既存として返す（他の DB エラーはそのまま）
- 戻り値の `user` は公開の列だけ（`localPassword` は含まない）
- 退会者を断りたい fork は、呼ぶ前に `userService.findByProvider` で状態を見てこの口を呼ばない（口の中に選択肢を足さない）
- 入れない物: 招待コード・流入の記録・プロフィール（呼び手がこの後に行う）。Firebase Auth のアカウントは作らない
- テスト: `pnpm test:create-from-provider`

### 名前の公開の部品

利用者を作る・名前を書く処理は普通 `createFromProvider`（外部の身元）や `userService` の作成・更新を使い、自分で users に書かない。
名前を自分で扱う必要があるときに使える部品（どれも公開）:

| 部品 | 場所 | すること |
|------|------|------|
| `sanitizeUserName(raw)` | `entities/userName.ts` | 外から来た名前から使えない文字を除き、前後の空白を削り、`maxLength` に収める（空になり得る。一意性は見ない） |
| `lockUserName(executor, name)` | `services/server/helpers/nameAvailability.ts` | 正規化名の advisory lock を tx の終わりまで取る（同名の同時書き込みを直列化。executor は tx） |
| `isUserNameTaken(name, { excludeUserId?, executor? })` | 同上 | 使用中か（削除済み・デモは占有しない、予約名を含む） |
| `findAvailableSuffixedUserName(name, { executor?, reserved?, lockCandidates? })` | 同上 | 「名前_2」… の空き名を探す（`lockCandidates: true` で候補もロック） |
| `withUserNameGuard({ name, excludeUserId? }, write)` | 同上 | 判定と書き込みを 1 つの tx で（使用中なら 409）。`unique.enabled` が false なら判定せず書く |

- 一意性を見るのは `USER_NAME_CONFIG.unique.enabled` のときだけ（`lockUserName` と `isUserNameTaken` を自分で呼ぶときも、この設定を見てから呼ぶ）
- users.status を書くなら `recordStatusTransition` も（ステータス遷移履歴の節）

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
