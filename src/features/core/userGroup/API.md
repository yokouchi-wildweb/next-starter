# userGroup API

## Overview

ユーザーグループのサーバーの口・管理の API・管理画面の部品と hook の形。何のためのドメインか・使い方は `README.md`、しくみは `Internals.md`。

## API

### 評価の口（`userGroupEvaluator`、`services/server/evaluation`）

- `count(target)`: `target` = `{ groupId }` か保存しない `{ definition }` → `{ count, memberLimit, overLimit }`
- `isMember(groupId, userId)` → `boolean`。重い部品を含む動的グループは 409（定期計算にすれば使える）。`userId` の形が違えば false
- `listMemberIds(groupId, { cursor?, limit? })` → `{ userIds, nextCursor }`。利用者 id の昇順の keyset、`limit` は 1〜`evaluation.listLimitMax`（既定は上限）、`nextCursor` = null で終わり
- `evaluate(definition, { sampleLimit? })` → `{ count, memberLimit, overLimit, sampleUserIds, heavy }`。保存しない（人数の見込み・出来事に伴う宛先のその場の評価）
- `sendTarget(groupId)` → `{ count, memberLimit, overLimit, version }`: 連絡の送り始めの確かめ。`version` = 定期計算の今の版の番号（静的・動的は null）。上限を超えても投げない（使い手が止める）
- `memberWhere(groupId, { version? })` → `{ where, count, timeoutMs }`: 連絡の送信の固定の時に users に付ける述語（drizzle の SQL）と、その 1 文に掛ける時間の上限。定期計算は渡した版の一員（その版が無ければ 409）。人数の上限を超えれば 409
- 人数の上限は `overLimit` で返す（止めるのは使う所: 送信の固定・静的グループへの書き込み）
- 誤り（DomainError）: 門が閉 404・無いグループ 404・グループの id の形 400・保管（archived）409・壊れた条件（部品が無い・引数が今の zod に合わない・定義が無い）409・定期計算の版が無い 409・その場の定義の誤り 400・時間の上限 503
- 部品を受けて作る `createUserGroupEvaluator({ db, criteria, config, gateEnabled, now })`（`--db` のテストは戻す取引を `db` に渡す）

### 静的グループへ書く口（`staticMemberWriter`、`services/server/writes`）

- `replaceMembers(groupId, source, { deadline?, maxChunks?, restart? })` → `{ status: "replaced", memberCount, added, removed, skipped }` か `{ status: "incomplete", staged, skipped }`
  - `source` = 利用者 id の配列か、keyset の供給 `(after, limit) => Promise<string[]>`（`after` より大きい id を昇順で `limit` 件、空 = 終わり。型 `UserIdSupplier`）
  - 締切（既定 = 今 + `recompute.budgetMs`）で止まれば `incomplete`（前の一員のまま）。同じ供給でもう一度呼ぶと続きから書く（締切が過ぎていても 1 回の呼び出しで少なくとも 1 束）。`restart: true` は下書きを捨てて最初から
  - 無い・削除された利用者は書かずに `skipped` に数える
- `addMembers(groupId, userIds)` → `{ added, skipped, memberCount }`
- `removeMembers(groupId, userIds)` → `{ removed, memberCount }`（一員でない id は何もしない）
- 人数の上限: 置き換えは超えた束で止めて下書きを消し 409（前の一員のまま）、足すは書かずに 409
- 誤り: 門が閉 404・id の形 400・無いグループ 404・保管 409・静的でない 409
- 監査の行を書かない口（管理者の操作は管理の API が記録する）
- 部品を受けて作る `createStaticMemberWriter({ db, config, gateEnabled })`

### 条件の定義の木（`entities/schema.ts`）

- 節: `{ op: "and" | "or", children: [...] }` / `{ op: "not", child }` / 葉 `{ part: <部品の key>, args }`
- `checkUserGroupDefinition(tree, { criteria, limits })` → `{ heavy, nodes, depth, parts }`。形の誤り・節の数と深さの上限・知らない部品・引数の誤りは DomainError 400（どの節か `根.children.1` の形で言う）

### 管理の API（`/api/admin/user-groups/**`）

どの口も管理者カテゴリだけ（`createApiRoute` の access `{ roleCategories: ["admin"] }`）、門 `userGroups` が閉なら 404。service でも管理者か system かを確かめる（403）。返す形は表示名が先（`kindLabel`・`statusLabel`）で、内部の鍵は値としてだけ持つ。例外の持ち主付きのグループは一覧・1 件・選択肢に出さない（404）。

- `GET /api/admin/user-groups?kind&status&cursor&limit` → `{ items, nextCursor }`。`status` は省略可(無ければ使用中とアーカイブの両方)、`limit` 1〜50 既定 20、新しい順
  - 1 件の形: `id`・`name`・`description`・`kind` / `kindLabel`・`status` / `statusLabel`・`count`・`recompute`・`createdAt`・`updatedAt`
  - `count: { value, state }`: `counted`（静的 = 一員の数、定期計算 = 今の版の人数）/ `estimated`（動的をその場で数えた）/ `not_computed`（時間の上限・1 ページの予算が尽きた・壊れた条件）/ `none`（定期計算に版がまだ無い）
  - `recompute`（定期計算だけ）: `{ intervalMinutes, defaultIntervalMinutes, lastComputedAt, lastFailure: { at, reason } | null, computing }`
- `POST /api/admin/user-groups` 作る `{ name, description?, kind, definition?, recomputeIntervalMinutes? }`（動的・定期計算は定義が要る、静的は持たない。間隔は 60〜43,200 分か null）→ 1 件の詳しい形
  - 動的・定期計算は `exceptions?: { include?: userIds, exclude?: userIds }`（例外の人）も渡せる。グループ・例外の人のグループ・一員を 1 つの取引で書き、誤り（静的に渡した・同じ人が両方 400、人数の上限 409）は作成ごと取り消す
- `GET /api/admin/user-groups/[id]` → 一覧の形 + `definition`（例外の包みを外した元の定義。静的は null）・`heavy`・`notices`（画面に出す注意）・`exceptions: { includeCount, excludeCount } | null`
- `PATCH /api/admin/user-groups/[id]` 直す（名前・説明・種類・定義・間隔）。種類の付け替えは動的 ⇄ 定期計算だけ（静的との間は 409）。保管したグループは 409
- `DELETE /api/admin/user-groups/[id]` 削除（どの状態でも）→ `{ id, deleted: true }`。削除していない送信の宛先・ほかのグループの条件（固定グループの一員）で使われていれば 409（code `group_referenced`、文に理由）。消すと定義・版・一員・例外の人のグループも消える。一覧・1 件の形に `deletable`・`deleteReasons`（行の操作に出す理由の文）。監査 `user_group.group.deleted`
- `POST /api/admin/user-groups/[id]/archive` 保管（画面「アーカイブする」）
- `POST /api/admin/user-groups/[id]/restore` 使用中に戻す（画面「アクティブに戻す」。アーカイブ中でなければ 409。定期計算は次の cron で期限が来れば計算し直す）
- `POST /api/admin/user-groups/estimate` `{ definition }` か `{ groupId }` → `{ count, memberLimit, overLimit, heavy, sample: [{ id, name }] }`（メールは返さない。時間の上限で 503）
- `PUT /api/admin/user-groups/[id]/exceptions` `{ include?: { clear?, add?, remove? }, exclude?: { clear?, add?, remove? } }`（`clear: true` = その側を全員外す。足す・外すより先に）（動的・定期計算だけ、静的は 409）→ 1 件の詳しい形。足す人に入れた人は外す人から外れる（逆も）
- `GET /api/admin/user-groups/[id]/exceptions?side=include|exclude&q&cursor&limit` → `{ items: [{ id, name }], nextCursor }`（`limit` 1〜100 既定 50、例外がまだ無ければ空、静的は 409）
- `POST /api/admin/user-groups/static` 静的グループを作る `{ name, description?, from }` → `{ group, members }`
- `POST /api/admin/user-groups/[id]/members`（静的だけ、ほかは 409）
  - `{ mode: "add", userIds }` → `{ group, members: { status: "added", added, skipped, memberCount } }`
  - `{ mode: "replace", from }` → `{ group, members }`（`members` は書く口の置き換えの結果）
  - `{ mode: "remove", userIds }` → `{ memberCount }`
  - `{ mode: "clear" }` → `{ group, members }`（全員を外す。空の置き換えと同じ予算つきの書き込み、`members` は置き換えの結果。監査 `user_group.members.cleared`）
  - `from` = `{ type: "users", userIds }` / `{ type: "group", groupId }`（別のグループの今の一員）/ `{ type: "tag", tagId }`（タグの今の持ち主）
  - 1 回の要求の予算は `admin.freezeBudgetMs`。`members.status` が `incomplete` なら、画面が同じ `from` で `{ mode: "replace" }` を送り直すと続きから書く（サーバーは元を覚えない）
- `GET /api/admin/user-groups/[id]/members?q&cursor&limit` → `{ items: [{ id, name }], nextCursor }`（`q` = 名前かメールアドレスの部分一致 1〜100 文字。例外の人の一覧も同じ。静的だけ、`limit` 1〜100 既定 50、削除した利用者は出さない）
- `GET /api/admin/user-groups/[id]/people-search?target=members|include|exclude&q&cursor&limit` → `{ items: [{ id, name, inList, otherSide }], nextCursor }`（利用者を名前かメールアドレスの部分一致で探し、利用者 id の順の keyset。`inList` = 対象の一覧に入っている・`otherSide` = 例外の反対側に入っている（一員は null）。id の一覧を丸ごとは返さない。members は固定グループだけ、include / exclude は動的・定期計算だけ、ほかは 409）
- `POST /api/admin/user-groups/[id]/people-apply` `{ target, add, remove }`（各 10,000 件まで、同じ人を両方は 400）→ `{ target, added, removed, moved, counts }`（1 つの取引で外す → 足す。例外の片側へ足した人は反対側から外れ `moved` に数える。`counts` = 新しい人数 `{ memberCount }` か `{ includeCount, excludeCount }`。人数の上限を超えれば 409 で何も変えない。監査 `user_group.members.applied` / `user_group.exceptions.updated`）
- `GET /api/admin/user-groups/criteria` → `{ criteria: [{ key, label, description, weight, weightLabel, fields, inlineGroups }], options: { tags, staticGroups }, kinds }`（`inlineGroups` = 欄を横に 1 行で並べる組、FieldRenderer の `InlineFieldGroup` の形 `{ key, label, fields, fieldWidths? }`、無ければ []。上流: 期間の部品 = 期間 from〜to と直近 withinDays の 2 行・購入金額の合計 = 基準・通貨・下限・タグ = タグと一致条件）（使える部品だけ: `enabled: false`・読む機能が閉の部品は出ない）。タグ・静的グループの選択肢は `fields` にも入れて返す（`admin.optionsLimit` 件まで）
- 監査（`targetType` `user_group`、操作した管理者が actor、metadata は名前・種類・数だけで利用者 id は入れない）: `user_group.group.created` / `updated` / `archived` / `restored` / `deleted`・`user_group.exceptions.updated`・`user_group.members.replaced` / `added` / `removed` / `cleared` / `applied`

### 管理画面の部品と hook

- 住所 `/admin/user-groups`（メニューの「利用者」の分類、門が閉なら住所ごと隠れる）
- 入れ物: `AdminUserGroupList`（一覧、hook `useAdminUserGroupList`）・`AdminUserGroupModal`（作る・直すモーダル、hook `useUserGroupModal`）・`AdminUserGroupBulkActions`（利用者一覧の一括操作 `bulkCreateUserGroupAction` / `bulkAddToUserGroupAction`、user の受け口 `adminBulkActions` の項目 `userGroupCreate` / `userGroupAdd` が使う）
- 部品（props だけ、`components/common/<Part>`）: `UserGroupRow`・`UserGroupRecomputeStatus`・`UserGroupConditionBuilder`・`UserGroupCriterionFields`・`UserGroupEstimateView`・`UserGroupExceptionsEditor`・`UserGroupMemberList`・`UserGroupStaticSourceFields`・`UserGroupFreezeProgress`
- hook（入口 `hooks/index.ts`）: `useUserGroups` / `useUserGroup` / `useUserGroupCriteriaCatalog`（読む）・`useUserGroupForm`・`useUserGroupConditionBuilder`・`useUserGroupCriterionArgs`・`useUserGroupEstimate`・`useUserGroupFreeze`・`useUserGroupPeople`・`useUserGroupStaticMembers`・`useUserGroupExceptions`・`useAddToUserGroup`
- 画面は内部の鍵・id を出さない（部品の `label`、グループ名、利用者の表示名）。fork は自分の画面に同じ部品・モーダルを置ける
- client service `services/client/userGroupAdminClient.ts`（axios + normalizeHttpError。型は server の DTO と入力の zod を型だけ読む）
