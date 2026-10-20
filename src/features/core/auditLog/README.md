# auditLog - 汎用監査ログ

「**誰が** / **いつ** / **どのレコードに** / **誰に対して** / **何をしたか** / **何が変わったか**」を全ドメイン横断の append-only テーブル `audit_logs` に残す基盤。

- 記録すべきもの = **介入**（管理者の手動操作・ポリシー逸脱・権限や財産への直接操作）。**業務**イベントは載せない（→ [何を記録するか](#何を記録するか介入-vs-業務)）
- 記録方法 = `createCrudService` の `audit:` による自動記録 (A) と `auditLogger.record()` の手動記録 (B) の併用

---

## 基本構成

```
src/lib/audit/                     # ドメイン非依存の純粋ロジック (lib→features 禁止のためここに recorder 実体は置かない)
├── context.ts                     # ALS: runWithAuditContext / getAuditContext / requireAuditContext / runAsSystem
├── types.ts                       # AuditContext / AuditRecordInput / AuditRecorder (DI インターフェース)
├── diff.ts                        # computeAuditDiff
├── denylist.ts                    # 機微フィールド除外 (isDenylistedField / stripDenylisted)
└── validation.ts                  # validateActionName / validateTargetId / truncateLargeValues

src/features/core/auditLog/
├── constants/index.ts             # DEFAULT_RETENTION_DAYS (365) / AUDIT_MODE_DISABLED / ACTOR_TYPE_LABELS
├── entities/drizzle.ts            # audit_logs / audit_logs_failed (dead-letter) / audit_actor_type enum
├── services/server/
│   ├── auditLogService.ts         # auditLogger (record / recordDiff / recordMany / recordManyDiff)
│   ├── drizzleBase.ts             # 参照用 CRUD (auditLogBase / auditLogFailedBase)
│   ├── wrappers/                  # searchByTarget / searchBySubjectUser
│   ├── userVisibility.ts          # 本人開示 action フィルタ (buildUserVisibleActionsWhere)
│   ├── pruning.ts                 # pruneExpiredAuditLogs (cron)
│   └── recoverDeadLetter.ts       # recoverDeadLetterAuditLogs (cron)
├── services/client/auditLogClient.ts  # search / searchByTarget / searchBySubjectUser / fetchMine
├── hooks/                         # useAuditLogSearch / useAuditLogsByTarget / useAuditLogsBySubjectUser
├── components/common/             # AuditTimeline / UserActivityTimeline
├── presenters.ts                  # registerActionLabels / formatActionLabel 等
└── index.ts                       # client-safe バレル (server-only は非 export)
```

import の使い分け:

- **server（記録・参照）**: `import { auditLogger } from "@/features/core/auditLog/services/server";`
- **client / 表示系**: `import { AuditTimeline, auditLogClient, registerActionLabels } from "@/features/core/auditLog";`
- **context 操作**: `import { runAsSystem, runWithAuditContext } from "@/lib/audit";`

`auditLogger` はバレル (`@/features/core/auditLog`) からは export されない。Client Component 経由で `node:async_hooks` / DB ドライバがクライアントバンドルに流入するのを防ぐため。

関連ルート: `GET /api/admin/audit-logs/search`（admin カテゴリのみ）| `GET /api/me/audit-logs`（本人、fail-closed）| 管理画面 `/admin/audit-logs`（横断検索）| `/api/cron/audit-log-prune` / `/api/cron/audit-log-recover-dead-letter`

---

## 何を記録するか（介入 vs 業務）

audit_logs は **介入 (intervention)** だけを記録する。**業務 (business)** イベントまで載せると、統制目的の検索が業務イベントに埋もれ、ストレージ・I/O も膨らむ。

| 区分 | 例 | audit_logs |
|---|---|---|
| 介入 | 管理者が業務フロー外で手動操作する（admin 専用 API 経由）/ ポリシーを曲げる・緊急対応・手動修正 / 残高調整・ロール変更・強制状態遷移などユーザーの財産・権限への直接操作 | 載せる |
| 業務 | 設計どおり自動実行される高頻度処理（決済確定・消費・通知送信）/ ユーザー本人の正常系操作 / 業務テーブル（`wallet_histories` 等）やドメイン履歴で既に追跡できるもの | 載せない |

迷ったときの判断手順:

1. その関数が **admin から呼ばれる前提が 1 つでもあるか** → Yes なら介入として載せる
2. admin / system の両方から呼ばれる関数は **載せる**（`actor_type` で後から絞り込める）
3. 件数の大きい bulk 介入は `aggregate`（1 操作 1 行）で集約する
4. 業務テーブル + ドメイン履歴 + audit_logs の **三重記録はしない**（業務テーブルで完結させる）

適用例はウォレットが基準実装（`adjustBalance` / `clearBalance` は記録、`consumeReservedBalance` / `debitBalance` / `reserveBalance` は業務扱いで非記録）。全操作の対応表は [`wallet/README.md` の監査ログポリシー](../wallet/README.md) を参照。下流ドメイン（アイテム配布・サブスクリプション等）も同じ軸で判断する（例: 管理者の代理キャンセル = 介入、cron の自動更新 = 業務）。

---

## actor / subject / target

監査ログには独立した 3 つの軸がある。分けて持つことで「このユーザーへの全操作」「この管理者の全操作」「このレコードの履歴」をいずれも index で引ける。

| 軸 | カラム | 意味 | index |
|---|---|---|---|
| actor | `actor_id` / `actor_type` | 操作した主体（`system` / `admin` / `user` / `api_key` / `webhook`） | `audit_logs_actor_idx` |
| subject | `subject_user_id` | 操作対象のユーザー（data subject） | `audit_logs_subject_user_id_idx`（`IS NOT NULL` の partial） |
| target | `target_type` / `target_id` | 操作対象の **レコード**（`target_id` は text） | `audit_logs_target_idx` |

`target` だけでは足りない理由: 管理者があるユーザーのウォレットを調整すると行は `target_type='wallet'` で残るため、`target_type='user'` の検索には出てこない。GDPR 等のアクセス権・削除権対応でも「そのユーザーに関する全 audit」を 1 クエリで出せる必要がある。

### subjectUserId の設定ルール

- **ユーザーに紐づく操作では必ず `subjectUserId` をトップレベルで渡す**。`metadata.userId` に隠すのは禁止（jsonb スキャンになり、入れ忘れも検出できない）
- `target_type='user'` → `target_id` と同じ値を冗長に入れる
- 関連エンティティ（wallet 等）→ そのレコードが属する userId
- bulk aggregate・システム設定変更・対象ユーザー特定不能 → `null`（省略可）
- ESLint `audit/subject-required`（warn）が単件の `record` / `recordDiff` で未指定を検出する。対象は `targetType: "user"` または action が `user.` / `auth.` / `wallet.` / `purchase_request.` / `bank_transfer_review.` 等（`eslint-rules/audit-action-naming.mjs` の `REQUIRED_SUBJECT_ACTION_PREFIXES`）で始まるもの。`.bulk_` を含む action は除外。意図的に null にするなら `subjectUserId: null` を明示する

注意:

- **パターン A（`createCrudService` の `audit:`）は `subjectUserId` を設定しない**（常に NULL）。ユーザー単位タイムラインに出したい操作は B で記録する
- `bulkMode: "aggregate"` の行は subject が NULL になり `UserActivityTimeline` に出ない。bulk 介入もユーザー単位で出したいなら `recordMany` で N 行記録する（コストとのトレードオフでドメインごとに判断）

---

## 記録パターン

### A: `createCrudService` の `audit:` で CRUD を自動記録

`drizzleBase.ts` の設定だけで CRUD ライフサイクルを拾う。設定型は `AuditConfig`（`src/lib/crud/drizzle/types.ts`）、recorder は DI で渡す。

```ts
import { auditLogger } from "@/features/core/auditLog/services/server";

export const baseOptions = {
  // ...
  audit: {
    enabled: true,
    targetType: "post",
    actionPrefix: "post",
    trackedFields: ["title", "body", "status"], // 省略時 = denylist 適用後の全フィールド
    bulkMode: "aggregate",                      // 既定
    retentionDays: 365,                         // 省略時 = DEFAULT_RETENTION_DAYS (365)
    strict: true,                               // 既定。false で bestEffort (dead-letter 退避)
    recorder: auditLogger,
  },
} satisfies DrizzleCrudServiceOptions<...>;
```

| 操作 | action |
|---|---|
| create | `<prefix>.created` |
| update | `<prefix>.updated`（`recordDiff`、差分なしはスキップ） |
| remove / hardDelete | `<prefix>.deleted` / `<prefix>.hard_deleted` |
| restore | `<prefix>.restored` |
| upsert | `<prefix>.upserted` |
| bulk 系 | `<prefix>.bulk_deleted` / `bulk_hard_deleted` / `bulk_updated` / `bulk_upserted`（aggregate 時） |

実例: `user/services/server/drizzleBase.ts`（`bulkMode: "detail"`, 730 日。status / role / 削除は wrapper 側の個別 action に任せて重複させない）

### B: wrapper で `auditLogger.record()` を直接呼ぶ

一部のライフサイクルだけ記録したい / ドメイン固有の action 名を付けたい場合。**`tx` は必ず業務処理と同じものを渡す**（rollback 連動）。

```ts
import { auditLogger } from "@/features/core/auditLog/services/server";

await db.transaction(async (tx) => {
  // ... 業務処理
  await auditLogger.record({
    targetType: "post",
    targetId: id,
    subjectUserId: after.authorId,
    action: "post.status.changed",
    before: { status: before.status },
    after: { status: after.status },
    reason,
    tx,
  });
});
```

- `recordDiff({ before, after, trackedFields?, skipIfNoChanges? = true, ... })`: 差分を内部計算し、差分なしならスキップ
- `actorOverride: { actorId?, actorType? }`: 未認証経路（仮登録 / 本登録など context が system になる経路）で本人操作として記録したい場合。ip / UA / requestId は ALS の値を維持
- `context`: ALS を使わず明示指定する場合（テスト等）
- `metadata` / `reason` / `retentionDays` / `bestEffort` / `batchId` は任意

A で広く拾い、B でドメイン固有イベントを足す併用が推奨形。

### C: バッチ記録（`recordMany` / `recordManyDiff`）

同一 tx 内で同一 action を多数記録するときは `record()` を逐次 await しない（ラウンドトリップが累積してタイムアウトする）。`recordMany` は 1 ステートメント INSERT に集約する。`recordManyDiff` は `recordDiff` の N 件版で、差分なしの要素を除外し、全件スキップなら INSERT しない。

```ts
await auditLogger.recordMany(
  changed.map((row) => ({
    targetType: "user_item",
    targetId: row.id,
    subjectUserId: row.userId,
    action: "user_item.stock_status.changed",
    before: { stock_status: row.before },
    after: { stock_status: row.after },
    reason,
    tx,
  })),
);
```

- **制約**: 配列内で `tx` / `bestEffort` が混在、または明示 `batchId` が異なる値で混在すると throw（bestEffort でも握り潰さない）。空配列は即 return
- **チャンキング**: 1000 行 / INSERT に自動分割。caller の `tx` があれば全 chunk がその tx 上、`tx` なしで複数 chunk になる場合のみ内部で `db.transaction()` を張るため、途中 chunk だけ commit される状態にはならない
- **`batch_id`**: 呼び出しごとに UUID を共通発番して各行の `batch_id` に保存（`audit_logs_batch_id_idx`、partial）。関連する単件記録を同じグループに入れたい場合は `crypto.randomUUID()` を自前で発番し、`recordMany` の各要素と `record({ batchId })` の両方に渡す
- **失敗時（bestEffort）**: context 解決失敗 = 入力配列全体を 1 行で dead-letter | 個別 payload 構築失敗 = その要素のみ dead-letter | INSERT 失敗 = 構築済み全 payload を一括 INSERT で dead-letter

---

## action 命名

- 規約: `<domain>.<entity>.<verb_past>`（例: `user.email.changed`）。正規表現 `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$` = 小文字・数字・`_`、ドット区切り 2 セグメント以上
- NG 例: `User.Created`（大文字）/ `user-registered`（ハイフン）/ `userRegistered`（区切りなし）
- 静的検査: ESLint `audit/action-naming`（error）。`record` / `recordDiff` の action と `audit.actionPrefix` が文字列リテラルかつパターン一致であることを要求
- 実行時検査: `validateActionName` が throw（`src/lib/audit/validation.ts`）
- 動的に組み立てる正当なケースは個別 `eslint-disable` で許可する

---

## 保存内容の制御

- **trackedFields**: 監査として残す価値のあるフィールドだけを列挙するホワイトリスト。ドメイン固有の除外はこちらで行う
- **denylist**（`src/lib/audit/denylist.ts`）: 全ドメイン横断で before / after から除外。完全一致（`password` / `token` / `secret` / `apiKey` / `cardNumber` 等、大文字小文字無視）+ 末尾一致（`_password` / `_token` / `_secret` / `_apikey` / `_key`）。新しい機微フィールド名はここに追加する。`metadata` は denylist の対象外なので機微値を入れない
- **サイズ上限**: before / after が 16KB を超えると `truncateLargeValues` が超過キーを切り詰めマーカーに置換する

### bulkMode

| mode | 1 操作の記録 | 用途 |
|---|---|---|
| `aggregate`（既定） | 1 行（件数・条件等を metadata に集約、target_id は代表値） | 一般ドメイン |
| `detail` | N 行（各レコード） | 重要データ（user / wallet / payment）。before 取得の SELECT が増える |
| `off` | 0 行 | 高頻度大量データ |

### retention_days（行単位）

| 性質 | 推奨値 |
|---|---|
| コンプライアンス対象（user / payment / wallet） | 730 日以上 |
| 一般業務データ | 365 日（既定 `DEFAULT_RETENTION_DAYS`） |
| 高頻度ログ性データ | 90 日 |

`retentionDays` を記録時に渡せば行ごとに上書きできる。

### strict / bestEffort

| モード | 失敗時 |
|---|---|
| strict（既定。B では `bestEffort` 省略、A では `strict: true`） | throw → 呼び出し元 tx ごと rollback |
| bestEffort（B: `bestEffort: true`、A: `strict: false`） | `audit_logs_failed` に退避（親 tx とは独立に `db` で書く）して本処理は継続 |

介入の記録は strict、記録漏れより本処理継続を優先する計測的な記録だけ bestEffort にする。

---

## context（actor / IP / UA / requestId）

`auditLogger` は context を **ALS から暗黙取得** するため、wrapper のシグネチャに actor を通さない。

- `createApiRoute`（およびそれを使う `createDomainRoute` / `createMeRoute`）は handler 全体を `runWithAuditContext` で包む。handler 内の任意の深さから `record()` すれば actor / ip / userAgent / sessionId / requestId が付く
- **`createCronRoute` と `pnpm task` は context を敷かない**。cron / CLI / バックグラウンド処理から記録する場合は処理側で `runAsSystem` を張る（張らずに記録すると `AuditContext is not set` で throw、bestEffort なら dead-letter 行き）。実例: `wallet/services/server/lots/sweepExpiredLots.ts`

```ts
import { runAsSystem, runWithAuditContext } from "@/lib/audit";

await runAsSystem(async () => {
  await someBackgroundTask(); // 内部の record() は actor_type="system"
}, { requestId: jobId }); // requestId は省略可（自動発番）

await runWithAuditContext(
  { actorId: "batch-runner", actorType: "system", ip: null, userAgent: null, sessionId: null, requestId: crypto.randomUUID() },
  async () => { /* ... */ },
);
```

---

## 閲覧（UI / API）

### 管理者向け

```tsx
import { AuditTimeline, UserActivityTimeline } from "@/features/core/auditLog";

<AuditTimeline targetType="post" targetId={postId} />  {/* target 軸。targetId 省略で targetType 全体 */}
<UserActivityTimeline userId={userId} />                {/* subject 軸。target_type を跨いで集約 */}
```

- 両者とも無限スクロール + 行クリックで詳細モーダル（before / after の差分表示）、`pageSize` 既定 20
- `UserActivityTimeline` は `subject_user_id` で絞るため、**subjectUserId を設定していない記録は出ない**。ユーザー詳細の操作履歴として組み込む前に、該当ドメインの記録が subject を持っているか確認する（上流のユーザー管理モーダル `user/components/admin/AdminUserManageModal/HistoryTabContent.tsx` は target 軸の `AuditTimeline targetType="user"` を使用）
- 横断検索画面: `/admin/audit-logs`
- データ取得: hooks `useAuditLogsByTarget` / `useAuditLogsBySubjectUser` / `useAuditLogSearch`（→ `auditLogClient` → `GET /api/admin/audit-logs/search`）

### ユーザー本人向け（`GET /api/me/audit-logs`、fail-closed）

- 対象 = 「`target_type='user'` かつ `target_id`=本人」または「`actor_id`=本人」の行（**subject_user_id は見ない** = 本人のウォレット等が target の介入は返らない）
- さらに `src/registry/userVisibleAuditActionsRegistry.ts` の `USER_VISIBLE_AUDIT_ACTIONS` に登録された action だけを返す。上流は空 = 常に空結果（DB も照会しない）
- 理由: 監査ログには covert な管理操作（不正フラグ・強制介入・制限措置）が before / after 込みで残るため、本人に見せてよい action を明示オプトインさせる

```ts
// src/registry/userVisibleAuditActionsRegistry.ts（下流で編集）
export const USER_VISIBLE_AUDIT_ACTIONS: readonly string[] = [
  "wallet.balance.charged", // 完全一致
  "user.profile.*",         // prefix（末尾 ".*" のみ。単独 "*" は無視される）
];
```

- admin 側の経路（`/api/admin/audit-logs`、AuditTimeline / UserActivityTimeline）はこのレジストリの影響を受けない
- 本人向け履歴 UI は `auditLogClient.fetchMine` を、`hooks/` の既存フックと同形の派生フックで包んで使う（コンポーネントから ClientService を直接呼ばない）

### action ラベル

未登録の action は名前がそのまま表示される。表示名は `registerActionLabels` で追加する（AuditTimeline / 管理画面に反映）。

```ts
import { registerActionLabels } from "@/features/core/auditLog";

registerActionLabels({
  "post.created": "投稿を作成",
  "post.status.changed": "投稿ステータス変更",
});
```

---

## 運用

### cron

| タスク | 頻度 | 内容 |
|---|---|---|
| `audit-log-prune` | daily | `created_at + retention_days` を過ぎた行を削除。1000 件 × 最大 100 反復 / 回、`FOR UPDATE SKIP LOCKED`。上限到達時は `truncated: true` で次回に持ち越し |
| `audit-log-recover-dead-letter` | hourly | `audit_logs_failed` を古い順に最大 500 件再投入し、成功分を削除 |

- 配線: `src/registry/cronTaskRegistry.ts` に登録済み。dispatcher が自動起動する（`vercel.json` への個別登録は不要）。手動は `pnpm task <task>`
- dead-letter が減らない場合は `audit_logs_failed.error_message` を確認する（schema 不整合・payload 形状不一致など）
- 制約: 現行の `recoverDeadLetterAuditLogs` は再投入時に `subject_user_id` を復元しない（payload に値があっても NULL で入る）

### 緊急停止

`AUDIT_MODE=disabled` で `auditLogger` の全記録が no-op になる（インシデント対応用の最終手段）。復旧後の補填は別途検討する。

### schema / index

- 新しい列・index を反映する前に `subjectUserId` 等を渡すと INSERT が失敗するため、リリース前に `pnpm db:push` を済ませる
- `audit_logs` は肥大化しやすく、非 CONCURRENTLY の `CREATE INDEX` は書き込みロックで全 audit 記録を止める。本番の大きなテーブルへの index 追加は、生成 SQL を `CREATE INDEX CONCURRENTLY` に書き換えて先行適用するか、メンテナンス時間帯に push する
- 将来: `created_at` による RANGE パーティショニング導入時は prune をパーティション DROP に置き換える
