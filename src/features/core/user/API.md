# user — API

## Overview

user の README の API を分けた文書。列・型・スキーマと、公開の口の契約を持つ。使い方は `README.md`、仕組みは `Internals.md`。

## API

### ユーザーテーブルの列

列は `entities/drizzle.ts` の `UserTable` が正。注意の要る列:

- `signupIp`: 登録時 IP（referral / 管理画面が参照）
- `metadata`: JSONB。`loginHistory`（直近ログイン履歴）等を格納

- 秘匿カラム（localPassword）: `entities/drizzle.ts` の `defineHiddenColumns(UserTable, ["localPassword"])` 宣言により、`userService`（createCrudService）の全戻り値・他ドメインの `withRelations` 展開で 常に null 化 され、API レスポンスに乗ることはない。サーバー内部でハッシュを読む正規経路は `services/server/finders/findByIdWithSecrets.ts`（ID 指定・削除済み含む）と `findByLocalEmail.ts`（ローカルログイン用）の 2 つの直接 drizzle ファインダーのみ。仕組みの詳細は `src/lib/crud/README.md` の hiddenColumns 節を参照。

- 更新の入口: `userService.update(id, data)` = 認可済みの呼び手用（汎用 API は管理者限定、サーバー内の処理。管理者のスキーマで検証し、セッションは読まない）。`userService.updateSelf(actor, data)` = 本人用（`actor` は route の `ctx.user`。本人のスキーマ、非管理者のローカル認証は 400）。

- 検証の失敗: スキーマが書いた文はそのまま返し、Zod の既定の文（"Invalid url" など）は `src/features/core/user/config.ts の updateValidation` の固定文に置き換える。失敗した項目の path と code だけを server にログ（値は出さない）。

- パスワード変更の契約（`newPassword`）: `userService.update(id, { newPassword })` は プロバイダー非依存の「このユーザーのパスワードをこれにする」 契約
  - UI（`AdminUserManageModal` 認証タブ等）は保存先を知らず、`services/server/helpers/passwordChange.ts` の `planPasswordChange` がサーバー側で振り分ける: `local` → `localPassword` としてスキーマ入力にマージ（hash 変換・ロックアウトカウンタリセット・全セッション失効は既存経路がそのまま動く）| `email` → Firebase Auth へ同期 | それ以外（OAuth/OIDC/SAML 等）→ DomainError 400。
  - `localPassword` を直接渡す旧経路も引き続き有効。回帰テスト: `pnpm test src/features/core/user/services/server/helpers/passwordChange.test.ts`。

- IP データの所在に注意: ログイン / サインアップの IP は `signupIp` 列・`metadata.loginHistory` (JSONB)・専用テーブル `user_login_events` の 3 か所に併存する
  - IP の検索の口は [`userLoginEvent` ドメイン](../userLoginEvent/README.md) の `countDistinctUsersByIp` / `findUsersBySameIp` / `findUsersBySubnet`、端末受け渡しの検出は `findSessionHandoffsByUser` / `findSessionHandoffsByIp`。明示ログアウト (logout / pause / withdraw) も同テーブルに `logout` 行として入る。併存の理由と移行方針は同 README を参照。

### Enum

**user_role:**
```
admin, user, editor, debugger, contributor, ...（並びは extensions/roles.ts）
```

**user_provider_type:** 値は `constants/provider.ts` の `USER_PROVIDER_TYPES`

**user_status:**
```
pending, active, inactive, suspended, banned, security_locked, withdrawn
```

定義元は `constants/status.ts` の `USER_STATUSES`（意味は [ユーザーステータス](./README.md#ユーザーステータス) を参照）。

### ロールの JSON(`<id>.role.json`)

1 ロール 1 ファイル `<id>.role.json`（core ロール = `coreRoles/` の admin・user・debugger の 3 つ、削除・無効化は不可。追加ロール = `roles/`）。

- `pnpm generate role -- --delete`・`pnpm generate role -- --toggle` は core ロールで止まる。`roles/` に core と同じ ID、`coreRoles/` に 3 つ以外のファイル、`isCore` を書いた JSON は `pnpm generate role` と forge の事前検査で止まる
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

### バリデーションスキーマ

`entities/schema.ts` で Zod スキーマを定義。

| スキーマ | 用途 |
|---------|------|
| `UserCoreSchema` | 全フィールドの基本スキーマ |
| `UserOptionalSchema` | 更新用（フィールドをオプショナル化） |
| `UserUpdateByAdminSchema` | 管理者による更新用 |
| `UserSelfUpdateSchema` | ユーザー自身による更新用 |

### 表示名のスキーマ

`users.name` の仕様。マイページ等の UI ラベルでは「ユーザー名」、コード・スキーマ上は「表示名 (display name)」
と呼んでいるが同一フィールドを指す。「ユーザー名の重複禁止」を検討している場合はこのセクションが該当する。

設定: `src/features/core/user/config.ts の name`（`userConfig.name`）

共有スキーマ `entities/userName.ts` を全書き込み経路（サインアップ・本登録・マイページ・管理画面）で使用する。
デモユーザーの作成経路（`createDemoUser` / `createGuestDemoUser` / シードの `seedCreate`(`services/server/creation/seedCreate.ts`。シード `seed.ts` が呼び、デモの利用者だけを作る)）は
`isDemo = true` で一意性の判定スコープ外のため、一意性ガードを通さない（意図した設計）。

| スキーマ | 用途 |
|---------|------|
| `UserNameSchema` | 必須の経路（サインアップ `RegistrationSchema`、本登録 `UserActivationSchema`） |
| `UserNameNullishSchema` | エンティティ側の任意フィールド（`UserCoreSchema.name`。空文字は null に正規化） |
| `UserNameFormSchema` | react-hook-form 用（空文字 = クリアを許容、文字列のまま検証） |

ルール: trim + `maxLength`（既定 30、設定で調整）+ 制御文字/改行/ゼロ幅文字の拒否。
表示名のルールを変える場合は `userName.ts` だけを変更すれば全経路に反映される。

外から来た名前（サインインプロバイダーの表示名など）を表示名にするときは `sanitizeUserName(raw)` で整える
（使用できない文字の除去 + trim + `maxLength` で切る。空文字になりうる。一意性は見ない。保存側の `withUserNameGuard` が見る）。

### 状態の一括変更の口

- `userService.bulkChangeStatus({ userIds, newStatus, reason, onlyFrom?, dryRun })` → `{ changed, skipped: [{ userId, why }], failed: [{ userId, error }] }`(README Usage「状態をまとめて変える」)

### 外部の認証の身元から作る口(createFromProvider)

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

- 名前: `sanitizeUserName(displayName)`、空なら既定名 `PROVIDER_USER_DEFAULT_NAME`（「ユーザー」）。`userConfig.name.unique.enabled` のとき
  `lockUserName` の後に使用中（予約名を含む）か見て、使用中なら `findAvailableSuffixedUserName`（「名前_2」…）。無効のときはそのまま（他の作成の道と同じ規則）
- tx: 書き込み（引く・名前・作成または有効化・状態の履歴・監査）は 1 つの tx の中の savepoint で行う。呼び手の tx を渡せばそこで一緒に確定・巻き戻しする
- 同時に 2 回来て `(provider_type, provider_uid)` の unique 違反になったら savepoint だけ巻き戻して引き直し、既存として返す（他の DB エラーはそのまま）
- 戻り値の `user` は公開の列だけ（`localPassword` は含まない）
- 退会者を断るのは呼び手（呼ぶ前に `userService.findByProvider` で状態を見て、この口を呼ばない）
- 入れない物: 招待コード・流入の記録・プロフィール（呼び手がこの後に行う）。Firebase Auth のアカウントは作らない
- テスト: `pnpm test src/features/core/user/services/server/registration/createFromProvider.test.ts`

### 名前の公開の部品

利用者を作る・名前を書く処理は普通 `createFromProvider`（外部の身元）や `userService` の作成・更新。名前を自分で扱うときの部品（どれも公開）:

| 部品 | 場所 | すること |
|------|------|------|
| `sanitizeUserName(raw)` | `entities/userName.ts` | 外から来た名前から使えない文字を除き、前後の空白を削り、`maxLength` に収める（空になり得る。一意性は見ない） |
| `lockUserName(executor, name)` | `services/server/helpers/nameAvailability.ts` | 正規化名の advisory lock を tx の終わりまで取る（同名の同時書き込みを直列化。executor は tx） |
| `isUserNameTaken(name, { excludeUserId?, executor? })` | 同上 | 使用中か（削除済み・デモは占有しない、予約名を含む） |
| `findAvailableSuffixedUserName(name, { executor?, reserved?, lockCandidates? })` | 同上 | 「名前_2」… の空き名を探す（`lockCandidates: true` で候補もロック） |
| `isUserNamesTaken(names[])` | 同上 | 一括の判定（使用中の入力文字列の Set。単一クエリ、判定条件は `isUserNameTaken` と同じ） |
| `withUserNameGuard({ name, excludeUserId? }, write)` | 同上 | 判定と書き込みを 1 つの tx で（使用中なら 409）。`unique.enabled` が false なら判定せず書く |

### ステータス遷移履歴の表(user_status_histories)

| カラム | 型 | 説明 |
|--------|-----|------|
| `user_id` | uuid FK(users, cascade) | 対象ユーザー |
| `from_status` | user_status \| null | 遷移前。新規作成（INSERT）は null |
| `to_status` | user_status | 遷移後 |
| `trigger` | text | 遷移のきっかけ（語彙: `entities/model.ts` の `UserStatusTransitionTrigger`） |
| `changed_at` | timestamptz | 遷移日時 |

trigger 語彙: `self_withdraw` / `self_pause` / `self_reactivate` / `signup_pre_register` / `signup_activate` / `admin_change_status` / `admin_soft_delete` / `admin_restore` / `admin_create` / `demo_create` / `security_lockout`
