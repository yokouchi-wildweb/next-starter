# user ドメイン

## Overview

ユーザー管理の core ドメイン。ユーザーテーブル `users`・ロールの定義・状態とその遷移の記録・表示名の規則・退会と削除の後始末を持つ。

- 文書の分け方: 一覧と型・口の契約は `API.md`、仕組み(ロールの流れ・利用できる利用者・表示名の一意性・削除・状態の履歴)は `Internals.md`
- 置き場: `entities/`(drizzle・Zod・型)| `coreRoles/`(core ロール admin・user・debugger の JSON、消せない・無効にできない)| `roles/`(追加ロールの JSON)| `extensions/roles.ts`(ロールの一覧、`pnpm generate role` が書く)| `constants/`(ロール・状態・プロバイダの定数)| `services/server/`(`userService` ほか)

### ユーザーステータス

ユーザーのビジネス上の状態は `users.status` 1列で一元管理する（ラベルは `USER_STATUS_LABELS`）。

| ステータス | ラベル | 意味 | 主な遷移元 |
|-----------|--------|------|-----------|
| `pending` | 仮登録 | 認証プロバイダ側の登録は済んだが本登録（プロフィール入力等）前 | 新規サインアップ / `withdrawn` からの再入会（`registration/preRegisterFromAuth.ts`） |
| `active` | 有効 | 通常利用可能 | `pending`・`withdrawn` から本登録（`registration/activate.ts`）、`inactive` から復帰（accountLifecycle の `reactivate.ts`） |
| `inactive` | 休会中 | ユーザー自身による一時休止 | `active` から本人操作（accountLifecycle の `pause.ts`） |
| `suspended` | 処分保留 | 管理者による一時的な利用制限（復帰可能） | 管理者のステータス変更 |
| `banned` | 永久追放 | 規約違反等による恒久的な利用停止 | 管理者のステータス変更 |
| `security_locked` | セキュリティロック | 不正ログイン試行の検知等によるロック | ローカルログインのロックアウト（`wrappers/lockoutPolicy.ts`）等 |
| `withdrawn` | 退会済み | 退会済み（再サインアップで `pending` に戻り再入会できる） | `active` から本人退会（accountLifecycle の `withdraw.ts`）、管理者のソフトデリート |

| 定数 | 値 | 用途 |
|------|-----|------|
| `USER_AVAILABLE_STATUSES` | `active` | サービス利用可能 = ログイン済みとして扱うステータス。ページの守り(guard.ts / createLoader)の `allowStatuses` 既定値、API の Factory の認可（`apiAccess` の evaluateApiAccessRule、`allowStatuses` の既定値）が参照 |
| `USER_REGISTERED_STATUSES` | `active` / `inactive` / `suspended` / `banned` / `security_locked` | 本登録済み = 再登録不可。サインアップ時の既存ユーザー判定（`auth/services/server/registration.ts`）が参照 |

「利用不可」グループは `!USER_AVAILABLE_STATUSES.includes(status)` で表現できるため定義しない。

`active` 以外でログインした場合の扱いは範囲の守りの `statusRedirects` が振り分ける（`(user)/(protected)/guard.ts`: `inactive` → `/reactivate`、`suspended` / `banned` / `security_locked` → `/restricted`、`pending` / `withdrawn` → ログアウトしてサインアップへ）。ログイン時点で拒否されるステータスの詳細は auth ドメインの `localLogin.ts` / `firebaseSession.ts` を参照。

ステータス遷移の記録は [ステータス遷移履歴](#ステータス遷移履歴user_status_histories)、操作の監査は audit_logs（`user.withdrew` / `user.status.changed` 等）が担う。

## Usage

### ロールを足す

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

fork が上流のロールの `label`・`hasProfile`・`enabled` を変える上書きは、JSON の隣の `<JSON の名前>.override.ts`（`src/features/core/userProfile/README.md`「fork の上書き」）。

### 状態をまとめて変える

運用者が複数のユーザーの状態をまとめて変える(規約違反の一斉の処分保留・誤ロックの一斉の解除など)。

- コマンド(運用者): `pnpm task user:bulk-change-status -- --to <状態> (--users <id>[,<id>...] | --file <1 行 1 id のファイル>) --reason "<理由>" [--from <状態>] [--dry-run]`
  - 先に `--dry-run` で変わる人数と飛ばす人(理由つき)を確かめてから、外して打つ。本番は `--env production --confirm=production`
  - ユーザーは id の並びかファイルで渡す(状態で全員を拾う形は無い)。`--from` は渡した並びを「今その状態の人だけ」に絞るだけ
  - 止める鍵は無い: 打ち直すと既に変わった人を飛ばすので、途中で落ちても同じ指定で打ち直せる。実行は `task_runs` に記録され、監査の requestId = その行の id
- サービス: `userService.bulkChangeStatus({ userIds, newStatus, reason, onlyFrom?, dryRun })` → `{ changed, skipped: [{ userId, why }], failed: [{ userId, error }] }`。管理画面から呼ぶときも同じ関数
- 1 人ずつ `changeStatus` と同じ道: users の更新・遷移の履歴(trigger `admin_change_status`)・監査 `user.status.changed` を 1 人 1 transaction で書き、確定の後に banned / security_locked のセッション失効とロック解除の監査(`afterStatusChange`)。1 人の失敗は他の人を戻さない
- 変えられる先: `active` / `inactive` / `suspended` / `banned` / `security_locked`。`withdrawn`(退会の流れ `withdraw` がある)と `pending`(登録の途中)は先に止める
- 飛ばす: 知らない id・削除済み・既にその状態・`--from` でない・管理者のカテゴリのロール(管理者は 1 人ずつの画面で)
- `changeStatus(input, tx?)`: tx を渡すと更新・履歴・監査はその transaction の中で書き、確定の後の処理はしない(呼び手が commit の後に `afterStatusChange(before, newStatus, reason)` を呼ぶ)

### 表示名の一意性を有効にする

1. `unique.enabled: true` に変更してデプロイ（以後の新規書き込みから検証開始）
2. 既存の重複を確認: `pnpm task user:name-dedup -- --dry-run`
3. 既存の重複を解消: `pnpm task user:name-dedup`
   - 各グループで `createdAt` 最古のユーザーが元の名前を保持し、他は「名前_2」「名前_3」…に自動リネーム
   - リネームは `base.update` 経由のため audit_logs に記録される
   - 冪等・one-shot（定期実行しない）

DB 制約を使わないため、既存データに重複があっても有効化がブロックされることはない
（有効化〜解消完了までの間、既存重複はそのまま残り、新規の書き込みだけが検証される）。

#### 有効化時の注意

- リネームされたユーザーへの通知は組み込まれていない。 dedup は audit_logs に記録を残すが、
  本人向けの通知（「表示名が変更されました」等）は行わない。必要なら dry-run の結果
  （`renamed` の userId 一覧）をもとに `messagingService.send / bulkSend` で通知するのは
  ダウンストリームの責務
- セッション JWT の name クレームは古いまま残る。 リネーム後、DB 参照
  （loader の ctx.user・`requireUserRecord` 経由）の画面は即反映されるが、JWT クレームの name を表示に
  使っている箇所は再ログインまで旧名が見える（実害は表示のみ）

### プロフィール横断検索

ユーザー検索時に、プロフィールテーブルのフィールドも含めて横断検索できる。
テキスト横断検索（`searchQuery`）と構造化フィルタ（`profileWhere`）の 2 つの仕組みを提供。

#### サーバー（SSR ページ / ServerService）

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

#### クライアント（Hook）

```tsx
import { useSearchUserWithProfile } from "@/features/core/user/hooks/useSearchUserWithProfile";

const { data, total, isLoading } = useSearchUserWithProfile("contributor", {
  searchQuery: "田中",
  profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
  page: 1,
  limit: 20,
});
```

#### クライアント（サービス直接）

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

### 一括更新

管理者が複数ユーザーをまとめて更新する経路。列の性質で使い分ける。

| 更新したいもの | 経路 | 動作 |
|------|------|------|
| タグを足す / 外す（既存のタグは残す） | `useBulkAddUserTags` / `useBulkRemoveUserTags` の `trigger(userIds, tagIds)` | 1 文の SQL。再追加は何もしない |
| `adminMemo`、タグの置き換え | `useBulkUpdateByIdsUser`（同じ値）/ `useBulkUpdateUser`（行ごとに違う値） | `base` の一括更新。全件成功か全件失敗か |
| `status` / `role` | 1 人ずつ `useChangeUserStatus` / `useChangeUserRole` | 一括の経路は無い |
| `name` / `email` / `phoneNumber` / パスワード | 1 人ずつ `useUpdateUser` | 一括の経路は無い |

- 認可: 汎用 API の `ADMIN_ONLY`（管理者のみ）
- 許可する列: `src/features/core/user/config.ts の bulkUpdate` の `userConfig.bulkUpdate.fields`。それ以外の列は黙って捨てず 400
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

テスト: `pnpm test src/features/core/user/services/server/helpers/nameAvailability.test.ts`（DB 不要な判定ロジックのみ。同時実行の直列化と SQL の判定スコープは対象外）

一括判定が必要な場合（候補名リストのフィルタリング等）は `isUserNamesTaken(names[]) => Set<使用中の入力文字列>`
を使う（単一クエリ + 同一の判定条件。`isUserNameTaken` はこの単発版）。

### アバターを自前の見た目で変える

自分のアバターの変更・削除の流れを持つ公開の hook（`hooks/useAvatarChange.ts`）。見た目を持たない。マイページのアカウントの部品 `components/common/AccountAvatarSection` はこれを呼んで描いており、

`AccountAvatarSection` の値の指定は `size`・`acceptTypes`・`maxFileSize`・`onAvatarUpdated`。アバター未設定のときに丸の中に出す物（頭文字・別の絵など）は `children` で渡す（省略時は既定の人の形。丸の箱は部品が持つ）。描き分けの関数（旧 `renderFallback`）は持たない（core のドメインの部品は値の指定と children だけ）。

流れ: 検査（型・サイズ）→ `useAvatarUpload().upload`（用途 `user.avatar`）→ `useUpdateMyProfile().updateProfile({ name, avatarUrl: ref })`（サーバーの storage binding が保存と同じ TX で台帳に紐付ける）→ 保存が失敗（null）なら `discard(objectId)` でアップロードしたファイルを取り消す。削除は `avatarUrl: null` で保存する。

| 引数 | 既定 | 中身 |
|------|------|------|
| `user` | 必須 | 今の利用者。`avatarUrl` の初期値と、保存に送る `name` |
| `acceptTypes` | `DEFAULT_AVATAR_ACCEPT_TYPES`（`STRIP_IMAGE_TYPES` をカンマで連結） | 受け付ける MIME 型。file input の `accept` にもそのまま渡せる |
| `maxFileSize` | `DEFAULT_AVATAR_MAX_FILE_SIZE`（5MB） | 最大ファイルサイズ（バイト） |
| `onAvatarUpdated` | なし | 変更・削除の保存が済んだ後に保存後の利用者で呼ぶ |

戻り値:

- `avatarUrl`: 今のアバターの ref（保存が済むと変わる。未設定 = null）
- `validate(file)`: 検査だけ（状態を変えない）。だめなら文言（`対応していないファイル形式です` / `ファイルサイズは<n>MB以下にしてください`）、良ければ null。選んだ時点の先回りの表示に使う
- `change(file)`: 検査 → アップロード → 保存。保存まで済めば true。検査の失敗・アップロードの失敗・保存の失敗は false で `error` に文言が入る
- `remove()`: アバターを外して保存。済めば true
- `isUploading` / `isRemoving` / `isBusy`: 処理中（`isBusy` = どちらか）
- `error`: 検査・アップロードの失敗の文言、無ければ保存の失敗の文言（`string | null`）。`clearError()` で両方消す
- `acceptTypes` / `maxFileSize`: 実際に使っている値（input の `accept` と案内の表示用）
- 変更と削除は 1 つの鍵を共有する。処理中の `change` / `remove` は何もせず false（ボタンを `isBusy` で無効にするのとは別に、二重の呼び出しを止める）

画像のメタデータ: 用途 `user.avatar` は常に strip（サーバーが再エンコードして GPS / EXIF などを消す。CLAUDE.md FEATURES storage_metadata）。受け付ける型は strip できる型 `STRIP_IMAGE_TYPES`（具体型の列挙なので iOS は HEIC を JPEG にして渡す）。`acceptTypes` を広げても strip できない型はサーバーが拒む。用途は変えない。

fork が自前の見た目で使う（例: `src/app/(user)/(protected)/mypage/_components/ProfileCard.tsx`）:

```tsx
"use client";

import { useRef } from "react";

import { useAvatarChange } from "@/features/core/user/hooks/useAvatarChange";
import type { User } from "@/features/core/user/entities";

export function ProfileCard({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { avatarUrl, change, isBusy, error, acceptTypes } = useAvatarChange({ user });
  // 見た目は自由: avatarUrl を描き、押したら inputRef.current?.click()、選んだら change(file)
  // <input ref={inputRef} type="file" accept={acceptTypes} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void change(f); }} />
  // error を出し、isBusy の間は押せなくする
}
```

- 低い層の `useAvatarUpload`（`upload` / `discard`）と `useUpdateMyProfile` はそのまま公開（戻り値の形は変えない）。自前の前処理（縮小など）を挟む流れは低い層を使ってよい
- 回帰: `pnpm test src/features/core/user`（`hooks/useAvatarChange.test.tsx`・`components/common/AccountAvatarSection.test.tsx`）

### 管理画面の一般ユーザー一覧を作り替える

`/admin/users/general` の一覧（`components/admin/GeneralUserList` = `UserListHeader` + `Table`）は、処理と見た目を分けて公開している。fork は `_components/` に自前の Table を置いてこの 2 つを呼ぶ。

- `useGeneralUserListTable({ onChanged? })`（`hooks/useGeneralUserListTable.ts`）: 一覧の処理。見た目を持たない
- `createGeneralUserListColumns(options)`（入口 `components/admin` から）: 上流の列（並び・セルの中身）を `DataTableColumn<User>[]` で返す。fork は戻り値に自分の列を差し込む
- `UserListHeader`（`components/common/UserListHeader`）: 並び替えの候補 `sortOptions` と既定値 `defaultSort` を渡せる

#### useGeneralUserListTable の戻り値

| キー | 中身 |
|------|------|
| `canAdjustWallet` | ポイント操作を出すか（gate `wallet` が開いていて `walletConfig.enableAdminBalanceAdjust`） |
| `canManage` | 管理モーダルを使うか（`userConfig.enableUserManagement`）。false = 削除の確認ダイアログ |
| `canMemo` | メモの列を出すか（`userConfig.enableUserMemo`） |
| `selection` | `{ enabled, behavior, selectionMode }`（`userConfig.userListPage`。`enabled` = `enableSelectionTable.general`） |
| `bulkActions` / `onBulkDone` | 一括操作の項目（受け口 `adminBulkActions` の `"general"`）と、`BulkActionItems` の `onDone` に渡す再読み込み |
| `adjust` | `{ target, open(user), close, onAdjusted }`。`onAdjusted` は `AdminWalletAdjustModal` の `onSuccess` に渡す再読み込み |
| `manage` | `{ target, open(user), close }`（`AdminUserManageModal` 用） |
| `remove` | `{ target, request(user), cancel, confirm(), isDeleting }`。`confirm` = ソフトデリート → 成功トースト・閉じる・再読み込み / 失敗はエラートーストで開いたまま |
| `refresh` | `router.refresh()` の後に `onChanged?.()` |
| `columnOptions` | `createGeneralUserListColumns` に広げて渡す値（`canAdjustWallet` / `canManage` / `canMemo` / `isDeleting` / `onAdjust` / `onManage` / `onDelete`） |

`createGeneralUserListColumns({ ...columnOptions, editBasePath })` の列: ステータス・ロール・表示名・認証方法・メールアドレス・登録日・（`canMemo` のとき）メモ・操作（ポイント操作 / 管理 か削除 / 編集 = `${editBasePath}/<id>/edit`）。

#### UserListHeader の並び替え

- `sortOptions?: { label, value }[]`: 既定 = `DEFAULT_USER_LIST_SORT_OPTIONS`（登録日順 `createdAt`・更新日順 `updatedAt`）
- `defaultSort?: string`: `?sortBy=` が無いときに選ばれている値（既定 `createdAt`）
- 選んだ値は `?sortBy=` に乗るだけ。並べるのは loader（上流は `utils/adminUserListQuery.ts` の `buildAdminUserListQuery` が `updatedAt` 以外を `createdAt` で並べる）。値を足した fork は自前の loader でその値を解釈し、`defaultSort` は loader の既定の並びと揃える

#### fork の例

`src/app/admin/(protected)/users/general/_components/GeneralUserListTable.tsx`（page.tsx の切り替えと Screen の置き換えは src/lib/screens/README.md）:

```tsx
"use client";

import { useMemo, useState } from "react";

import { BulkActionItems, DataTable, RecordSelectionTable, type DataTableColumn } from "@/lib/tableSuite";
import Dialog from "@/components/Overlays/Dialog";
import type { User } from "@/features/core/user/entities";
import { AdminUserManageModal, createGeneralUserListColumns } from "@/features/core/user/components/admin";
import { useGeneralUserListTable } from "@/features/core/user/hooks/useGeneralUserListTable";
import AdminWalletAdjustModal from "@/features/core/wallet/components/AdminWalletAdjustModal";
import { useGate } from "@/featureGate/client";

export function GeneralUserListTable({ users, coinBalanceMap }: { users: User[]; coinBalanceMap: Record<string, number> }) {
  const t = useGeneralUserListTable();
  // wallet のモーダルを読むファイルは自分で開閉を確かめる(下の注)
  const walletEnabled = useGate().enabled("wallet");
  const [historyUser, setHistoryUser] = useState<User | null>(null);

  const columns = useMemo(() => {
    const base = createGeneralUserListColumns({ ...t.columnOptions, editBasePath: "/admin/users/general" });
    const coin: DataTableColumn<User> = { header: "保有コイン", render: (u) => coinBalanceMap[u.id] ?? 0 };
    // 操作の列(最後)の前に差し込む
    return [...base.slice(0, -1), coin, base[base.length - 1]];
  }, [t.columnOptions, coinBalanceMap]);

  const table = t.selection.enabled ? (
    <RecordSelectionTable
      items={users}
      columns={columns}
      getKey={(u) => u.id}
      onRowClick={setHistoryUser}
      selectionBehavior={t.selection.behavior}
      selectionMode={t.selection.selectionMode}
      bulkActions={(selection) => <BulkActionItems items={t.bulkActions} selection={selection} onDone={t.onBulkDone} />}
    />
  ) : (
    <DataTable items={users} columns={columns} getKey={(u) => u.id} onRowClick={setHistoryUser} />
  );

  return (
    <>
      {table}
      {walletEnabled && t.canAdjustWallet ? (
        <AdminWalletAdjustModal open={Boolean(t.adjust.target)} user={t.adjust.target} onClose={t.adjust.close} onSuccess={t.adjust.onAdjusted} />
      ) : null}
      {t.canManage ? (
        <AdminUserManageModal open={Boolean(t.manage.target)} user={t.manage.target} onClose={t.manage.close} />
      ) : (
        <Dialog
          open={Boolean(t.remove.target)}
          onOpenChange={(open) => !open && t.remove.cancel()}
          title="ユーザー削除"
          description={`${t.remove.target?.name ?? "このユーザー"} を削除します。`}
          confirmLabel="削除する"
          cancelLabel="キャンセル"
          onConfirm={t.remove.confirm}
          confirmDisabled={t.remove.isDeleting}
          confirmVariant="destructive"
        />
      )}
      {/* historyUser で自前のモーダルを開く */}
    </>
  );
}
```

ヘッダーに並び替えを足す（loader 側で `coinBalance` を解釈する）:

```tsx
import UserListHeader, { DEFAULT_USER_LIST_SORT_OPTIONS } from "@/features/core/user/components/common/UserListHeader";

const SORT_OPTIONS = [...DEFAULT_USER_LIST_SORT_OPTIONS, { label: "保有コイン順", value: "coinBalance" }];
// <UserListHeader {...props} sortOptions={SORT_OPTIONS} />
```

- wallet の部品（`AdminWalletAdjustModal`）を import するファイルの中の `useGate().enabled("wallet")`: `canAdjustWallet` も同じ gate を含むが、featureGate の依存の検査は import するファイルの字面だけを見るので、フックの中の確認は数えない（src/featureGate/README.md「依存の検査」の 2）。wallet を必ず使う fork は代わりに `required/wallet.ts` でもよい（同 5）
- 上流の `GeneralUserList` / `GeneralUserListTable` / `UserListHeader` の props は変わらない（足したものは省略できる）
- 回帰: `pnpm test src/features/core/user`（`hooks/useGeneralUserListTable.test.tsx`・`components/admin/GeneralUserList/columns.test.tsx`・`components/common/UserListHeader.test.tsx`）

## API

利用者の列・型・口の契約は `API.md`(この README の API を分けた文書)。

## Extension

- マイページのアカウントの項目・マイページのメニュー・退会時のクリーンアップハンドラ・登録の完了のメール: `Extension.md`(この README の Extension を分けた文書)
- 管理のユーザー管理モーダルのタブ: `adminManageTabs/README.md`
- 表示名の予約名: `reservedNames/README.md`
- 管理一覧の一括操作: 受け口 `adminBulkActions/`(Usage「一括更新」)
- ロールの上書き: `<JSON の名前>.override.ts`(Usage「ロールを足す」)

## Internals

仕組みは `Internals.md`(この README の Internals を分けた文書)。

## Verification

- `pnpm test src/features/core/user`(マイページのメニュー・アバター・一般ユーザー一覧・管理モーダル)
- パスワードの振り分け: `pnpm test src/features/core/user/services/server/helpers/passwordChange.test.ts`
- 表示名の判定: `pnpm test src/features/core/user/services/server/helpers/nameAvailability.test.ts`(DB 不要な判定だけ。同時実行の直列化と SQL の判定スコープは対象外)
- 外部の身元から作る口: `pnpm test src/features/core/user/services/server/registration/createFromProvider.test.ts`
- 登録の完了のメールの文面: `pnpm test src/features/core/user/messages`

## Related

- `src/features/core/userProfile/` — ロール別プロフィール
- `src/registry/schemaRegistry.ts` — Drizzle スキーマの登録 / `src/lib/drizzle/` — Drizzle の設定
- auth: [auth README](../auth/README.md)(ログイン・登録・セッション)
- IP の記録: [userLoginEvent README](../userLoginEvent/README.md)
- ファイル: [storageObject README](../storageObject/README.md)
