# user — Internals

## Overview

user の README の Internals を分けた文書。ロールの流れ・利用できる利用者・表示名の一意性・退会と削除・状態の履歴の仕組み。

## Internals

### ロール定義からデータベースへの流れ

```
roles/*.role.json + coreRoles/*.role.json
       ↓ pnpm generate role
extensions/roles.ts (roles)
       ↓ import
constants/role.ts (ALL_ROLES → USER_ROLES)
       ↓ import
entities/drizzle.ts (UserRoleEnum)
       ↓ pnpm db:push
PostgreSQL (user_role enum)
```

`pnpm generate role`（forge が回す）が `extensions/roles.ts` に一覧を書き、`constants` が `ALL_ROLES` として再 export する。手で直さない。

一覧の並びは DB の enum `user_role` の順そのもの（`entities/drizzle.ts`）。生成は今の並びを保ち、新しいロールを末尾に足す。

`constants/role.ts` で `ALL_ROLES` から各種定数を生成。

```typescript
// constants/role.ts
import { roles as ALL_ROLES } from "@/domains/core/user/extensions/roles";

// DB スキーマ・バリデーション用の配列
export const USER_ROLES = ALL_ROLES.map((r) => r.id);
// → ["admin", "user", "editor", "debugger", "contributor"]

// 型定義
export type UserRoleType = (typeof USER_ROLES)[number];
// → "admin" | "user" | "editor" | "debugger" | "contributor"
```

`entities/drizzle.ts` で PostgreSQL Enum とテーブルを定義。

```typescript
// entities/drizzle.ts
import { USER_ROLES } from "@/domains/core/user/constants";

// PostgreSQL Enum 定義
export const UserRoleEnum = pgEnum("user_role", [...USER_ROLES]);

// ユーザーテーブル
export const UserTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  role: UserRoleEnum("role").notNull(),
  // ...
});
```

- 反映は `pnpm db:push`

### 利用できる利用者の述語(`services/server/availableUsers.ts`)

サーバーの読み手が「利用できる利用者」で users の行を絞る 1 か所。`availableUserWhere({ includeDemo? })` → SQL の述語（where にそのまま渡し、他の条件とは and で組む）:

- 削除されていない（`deleted_at IS NULL`）・状態が `USER_AVAILABLE_STATUSES`（今は `active`）・デモの利用者（`is_demo`）は既定で外す（`includeDemo: true` で含める）
- 読み手: messaging の全員・ロール宛ての展開と数え（`messaging/services/server/sendMessage/store.ts` の `listUserIds` / `countUserIds`。選んだ利用者宛ては対象外）、ユーザーグループの母集団
- 入口の index は無いのでファイルのパスで読む（`@/domains/core/user/services/server/availableUsers`）
- 今は別の状態の並びを持つ所（まだこの述語を読まない）: API・ページの守り（routeFactory の `availableStatuses` と route ごとの `allowStatuses`）・共有端末（`pairedDevice` の principalUserRule）・client の `useStatusChecker`（`isAvailable`）
- 索引: `users_status_idx`・`users_deleted_at_idx`・`users_last_authenticated_at_idx`（最後のログインの条件）と `user_to_user_tag_tag_idx`（タグから利用者を引く。主キーは user_id が先）。素の列だけ（push の round-trip）

### 表示名の一意性(オプトイン、既定は重複許容)

`userConfig.name.unique.enabled: true` で表示名の重複を禁止できる。DB の unique 制約ではなく
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
（登録の `entities/user/entity.json` も `useImportExport: false`）。サービス内部では `base` を直接使える（表示名・
ステータス履歴の整合は呼び手が持つ）。

一括削除（`bulkDeleteByIds` / `bulkDeleteByQuery`）も `softDelete` のステータス変更・クリーンアップ・監査ログを
通らないため `userService` から公開しない。汎用の `/api/user/bulk/delete-by-ids` と `/api/user/bulk/delete-by-query` は
404（権限のない呼び出しは先に 401 / 403）。

単体の削除 `userService.delete`（汎用 `DELETE /api/user/:id`・`useDeleteUser`）は `softDelete` と同じ処理を通す
（`wrappers/delete.ts`）。削除済みのユーザーは 400、存在しないユーザーは 404。

### 退会と削除(2 段階)

| 操作 | 実装 | 内容 |
|------|------|------|
| 本人退会 | accountLifecycle の `services/server/withdraw.ts`（`active` のみ可） | status を `withdrawn` に変更 + クリーンアップ + 監査ログ `user.withdrew`（1 トランザクション）。行は残る。アバターなどのファイルも残す |
| ソフトデリート（管理者） | `wrappers/softDelete.ts` / `POST /api/admin/user/[userId]/delete`（汎用 `DELETE /api/user/:id` = `wrappers/delete.ts` も同じ） | `deleted_at` 設定 + status を `withdrawn` に変更 + クリーンアップ + 監査ログ `user.soft_deleted`（1 トランザクション）。ファイルは残す（復元できるように） |
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

### クリーンアップハンドラの仕組み

退会・ソフトデリート時に、他ドメインのリソース後始末を実行する仕組み。項目は `<ドメイン>/plugs/userCleanupHandlers/<名前>.ts`（`export const handler: UserCleanupItem`）、実行は `services/server/cleanup.ts` の `runCleanupItems`、呼び手の入口は `services/server/executeCleanup.ts`。

- accountLifecycle の `withdraw.ts` / `wrappers/softDelete.ts` の両方がトランザクション内で `executeCleanup(userId, tx)` を呼ぶ
- ステータス変更（`withdrawn` への更新）は項目の責務外。呼び出し元が自前で行う（softDelete は `setStatusWithdrawn`）

| 種類 | 失敗時の挙動 | 上流の登録 |
|------|-------------|-----------|
| `required: true` | 例外をそのまま投げ、トランザクション全体（ステータス変更・監査ログ含む）をロールバック | `wallet`（全ウォレットの balance / locked_balance を 0 にクリア + 履歴記録）・`messagingEndpoints`（端末の帳簿の本人の行を消す）・`messagingPreferences`（連絡の好みの本人の行を消す） |
| `required: false` | `console.error` に記録して続行 | `purchaseRequest`（pending / processing の購入リクエストを expired に。onExpire を持つ purchase_type は per-row でフック呼び出し） |

`required: true` → `false` の順に、それぞれファイル名の順で逐次実行する。`enabled` が false の項目は走らない（機能が無効ならテーブルが無い場合があるため。閉じられる機能を import する項目は `enabled` を書く、`pnpm test src/featureGate scripts/structure/proxies`）。

### ステータス遷移履歴(user_status_histories)

退会・休会・復帰・BAN 等のステータス遷移を恒久保存するサテライトテーブル。**常時オン**（設定フラグなし）。

- users テーブルに分析用カラム（withdrawnAt 等）を追加しない方針の実装。関心事ごとのサテライトテーブル
- audit_logs とは責務が別: 監査ログはコンプライアンス用途で保持期限つき（既定365日で prune）、本テーブルは集計用途で恒久保存
- 記録は `recordStatusTransition()`（`services/server/statusHistory.ts`）に集約。`fromStatus === toStatus` は no-op

集計の例:

```typescript
// 日別退会数（本人退会 + 管理者削除）
import { sql } from "drizzle-orm";
import { UserStatusHistoryTable } from "@/domains/core/user/entities/drizzle";

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
- ダッシュボードで重くなったら analytics の `withAnalyticsCache` → rollup（`src/domains/core/analytics/README.md`）に載せる。単純 GROUP BY のうちは cache のみで十分

過去分のバックフィル（導入時に 1 回だけ、冪等・再実行安全）:

```bash
pnpm task user:status-history-backfill
```

audit_logs に残っている `user.withdrew` / `user.status.changed` 等から復元する。監査ログの保持期限を過ぎて prune 済みの遷移は復元不可。
