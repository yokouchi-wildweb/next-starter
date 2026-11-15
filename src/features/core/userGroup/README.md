# userGroup（ユーザーグループ）

利用者の集まり（グループ）を名前つきで持つ core ドメイン（評議会の決定 D96〜D104）。連絡の宛先・限定ページ・ガチャの参加資格など、送ること以外にも多くのドメインが使う。呼び方は「ユーザーグループ」に揃え、「オーディエンス（audience）」の語は使わない（D100）。

今あるもの: 表・条件の部品の受け口と上流の部品 6 つ・条件の定義の木の検査・評価の口（count・isMember・listMemberIds・evaluate）・静的グループへ書く口（replaceMembers・addMembers・removeMembers）・定期計算の cron（user-group-recompute）・管理の API（`/api/admin/user-groups/**`）・管理画面（`/admin/user-groups`）・門・設定。

## 線（どこまでがグループか）

- user に列も表も足さない（独立したドメイン、門 `userGroups` がドメインごと閉じる D99）
- 母集団は削除されていない利用者。利用できる状態か（停止・休会など）は条件の部品か使い手が見る
- 出来事に伴う宛先（ある人のフォロワー・欲しい物の登録者・ある予約の人）はグループにしない。その機能が自分で引く（必要ならその場の定義で evaluate）。グループは「名前をつけて何度も使う集まり」

## 3 つの種類（`kind`、D103）

- `dynamic`（動的）: 条件の定義を保存し、使う時に引く。heavy の部品を含む動的グループは 1 人の確かめ（isMember）を拒む（定期計算にすれば使える）
- `scheduled`（定期計算の動的）: cron が予算つきで計算し、計算し終えた版を一度に切り替える（`user_group_versions` の版・計算の時刻・失敗、今の版 `user_groups.current_version`、版ごとの一員 `user_group_version_members`）
- `static`（静的）: 利用者 id の並び（`user_group_members`）。SQL で書けない条件は fork の task / cron が上流の口で静的グループへ書き、動的からは「この静的グループの一員」の部品で使う
- 例外の人を足す・外す: 画面の操作が裏で持ち主つきの静的グループ（`owner_group_id`）を作り、条件の木の「一員」の部品と not で表す。持ち主つきのグループは一覧と選択肢に出さず、持ち主を消すと一緒に消える（FK cascade）
- 状態（`status`）: `active` / `archived`（残すが選択肢に出さず、新しい宛先・条件に使えない）

## 表

- `user_groups`: id（uuid）・name・description・kind・owner_group_id・status・current_version・recompute_interval_minutes（定期計算の間隔の分、null = 設定の既定）・created_at・updated_at
- `user_group_definitions`: group_id（主キー）・tree（jsonb、条件の定義の木）・has_heavy・updated_at
- `user_group_members`: group_id × user_id（主キー）・created_at（利用者を消すと cascade）
- `user_group_versions`: id・group_id × version（一意）・status（computing / ready / failed）・started_at・computed_at・error・member_count・resume_after（書きかけの版の再開の位置 = 書き終えた最後の利用者 id）。静的グループの置き換えの下書きもこの表の computing の行（書き終えたら消える）
- `user_group_version_members`: version_id × user_id（主キー）

## 条件の部品（受け口 `criteria`）

`criteria/<名前>.ts` の `export const criterion`（型 `UserGroupCriterion`、`@/features/userGroup/types`）。`pnpm generate extensions` が `extensions/criteria.ts` の一覧にする。

```ts
// src/features/core/userGroup/criteria/registeredDays.ts(例。fork も受け口の項目としてここに足す)
import { sql } from "drizzle-orm";
import { z } from "zod";

import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

const args = z.object({ minDays: z.number().int().min(0) }).strict();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "registeredDays",
  label: "登録からの日数",
  args,
  fields: [{ name: "minDays", label: "何日以上", formInput: "numberInput" }],
  weight: "cheap",
  where: ({ minDays }, { now }) => sql`${UserTable.createdAt} <= ${new Date(now.getTime() - minDays * 86_400_000).toISOString()}`,
};
```

- `key`（一意）・`label`・`description?`・`args`（引数の zod。保存・評価の時に通す）・`fields`（管理画面の欄、フォームの欄の型 `FieldConfig`、name = args の鍵）・`weight`（`cheap` / `heavy`）・`where(args, { now })`（users の行への SQL の述語。他の表は EXISTS の副問い合わせで）
- id を集める関数の部品は置かない（SQL の述語だけ）。raw SQL に Date を埋めない（`.toISOString()`、CLAUDE.md raw_sql）

### 上流の部品（どれも cheap）

- `role`（ロール）: `{ roles }` のどれか
- `status`（状態）: `{ statuses }` のどれか。利用できる人だけにしたい時は「有効」を選ぶ（母集団は削除されていない利用者だけで、状態は見ない）
- `signupPeriod`（登録の時期、`created_at`）: `{ from?, to?, withinDays? }`（どれか 1 つ以上、重ねると and。withinDays = 評価の時刻から N 日以内）
- `lastLoginPeriod`（最後のログインの時期、`last_authenticated_at`）: 同じ形 + `notWithinDays?`（N 日ログインしていない。一度もログインしていない人も含む）
- `hasTag`（タグ）: `{ tagIds, match: any | all }`（any = どれか 1 つ、all = 全部）
- `inStaticGroup`（静的グループの一員）: `{ groupId }`。SQL で書けない条件を静的グループに書いて動的から使う口、例外の人を足す・外す（持ち主つきの静的グループ + not）もこれ。指す先が静的グループかは定義を保存する時に確かめる（管理画面の指令）
- 期間の部品の共通の部分は `utils/criteriaPeriod.ts`（Date は drizzle の演算子に渡す）

## 条件の定義の木

`{ op: "and" | "or", children: [...] }` / `{ op: "not", child }` / `{ part: <部品の鍵>, args }` の任意の木（`entities/schema.ts`）。`checkUserGroupDefinition(tree, { criteria, limits })`（`services/server`）が確かめ、`{ heavy, nodes, depth, parts }` を返す:

- 形の誤り・節の数 / 深さの上限・知らない部品の鍵・引数の zod の誤りは DomainError（400、どの節か `根.children.1` の形で言う）
- 上限は設定の値。管理画面は 2 段まで組め、それより深い定義は読むだけ

## 評価の口（`userGroupService` / `userGroupEvaluator`、`services/server/evaluation`）

- `count(target)`（`{ groupId }` か保存しない `{ definition }`）→ `{ count, memberLimit, overLimit }`
- `isMember(groupId, userId)` → boolean。heavy の部品を含む動的グループは拒む（409、定期計算にすれば使える）
- `listMemberIds(groupId, { cursor?, limit? })` → `{ userIds, nextCursor }`（利用者 id の昇順の keyset、limit は 1〜`evaluation.listLimitMax`）
- `evaluate(definition, { sampleLimit? })` → count + `sampleUserIds`（先頭の試しの一覧）+ `heavy`。保存しない（管理画面の人数の見込み・出来事に伴う宛先のその場の評価）
- 引き方: 静的 = `user_group_members` / 定期計算 = 今の版の `user_group_version_members`（版が無ければ 409）/ 動的 = 条件の木を users への 1 つの SQL にして引く（`compileUserGroupDefinition`、1 回の評価は 1 つの now を全部の葉に渡す）
- 母集団 = 削除されていない利用者。利用できる状態か（停止・休会・デモ）は部品「状態」か使い手が見る（連絡の全員・ロール宛ては user の `availableUserWhere`）
- 時間の上限: 数え・見込み・列挙は取引の中で `SET LOCAL statement_timeout`（`evaluation.timeoutMs`、既定 10 秒）。超えると 503（条件を絞るか定期計算に）
- 人数の上限（`memberLimit`）は `overLimit` で返す。止めるのは使う所（送信の固定・静的グループへの書き込み）
- 誤り（DomainError）: 門が閉 404（黙って false・全員に置き換えない）・無いグループ 404・グループの id の形 400・しまった（archived）409・壊れた条件（部品が無い・引数が今の zod に合わない）409・その場の定義の誤り 400・時間の上限 503
- 部品は db・部品の一覧・設定・門・時刻を受けて作る（`createUserGroupEvaluator`）。`--db` のテストは戻す取引を渡す

## 静的グループへ書く口（`userGroupService` / `staticMemberWriter`、`services/server/writes`）

- `replaceMembers(groupId, source, { deadline?, maxChunks?, restart? })` → `{ status: "replaced", memberCount, added, removed, skipped }` か `{ status: "incomplete", staged, skipped }`
  - `source` = 利用者 id の配列か、keyset の供給 `(after, limit) => after より大きい id を昇順で limit 件`（空 = 終わり。`UserIdSupplier`）
  - 新しい一員を静的グループの下書き（`user_group_versions` の computing の行 + `user_group_version_members`）へ利用者 id の昇順に束ごと（`write.batchSize`）に書き、書き終えたら 1 つの取引で `user_group_members` と入れ替える。読む側（評価の口・`inStaticGroup` の部品）は入れ替えの commit まで前の一員を見る。残る一員の `created_at` は変わらない
  - 締切（既定 = 今 + `recompute.budgetMs`）で止まれば `incomplete`（前の一員のまま）。同じ供給でもう一度呼ぶと `resume_after` から続ける（締切が過ぎていても 1 回の呼び出しで少なくとも 1 束は書く）。`restart: true` は下書きを捨てて最初から
  - 無い・削除された利用者は書かずに `skipped` に数える
- `addMembers(groupId, userIds)` → `{ added, skipped, memberCount }` / `removeMembers(groupId, userIds)` → `{ removed, memberCount }`: 1 つの取引（グループの行を FOR UPDATE、入れ替えと重ならない）
- 人数の上限（`memberLimit`）: 置き換えは下書きが超えた束で止めて下書きを消し 409（理由つき、前の一員のまま）、足すは書かずに 409。黙って途中で切らない
- 誤り: 門が閉 404・id の形 400・無いグループ 404・しまった 409・静的でない（動的・定期計算）409
- 監査の行は書かない: 管理者の操作は管理の API（次の指令）が記録する。fork の system の task はここで書かない
- fork の使い方: SQL で書けない条件（外のサービスの値・重い集計）は fork の task / cron（`runAsSystem` の中）で利用者を選び、keyset の供給で `replaceMembers` へ渡す。`incomplete` が返れば次の実行で同じ呼び出しを繰り返す。動的グループからは `inStaticGroup` の部品で使う

```ts
const result = await userGroupService.replaceMembers(groupId, async (after, limit) => myVipUserIds({ after, limit }));
if (result.status === "incomplete") return { ok: true, pending: true }; // 次の実行で続き
```

## 定期計算（cron `user-group-recompute`、`services/server/recompute`）

- 毎時 55 分（UTC）。**Vercel Hobby（`pnpm generate cron -- --plan hobby`）では 1 日 1 回**になり、グループの間隔が 1 日より短くても 1 日 1 回しか計算しない。門 `userGroups` が閉なら門番が飛ばす（task.ts が userGroup を import するので、生成の一覧の cronTasks に載る）
- 期限: 使える（active）定期計算のグループのうち、書きかけの版がある（続きを書く）か、最後の版の計算の開始から間隔（`recompute_interval_minutes`、null = `recompute.defaultIntervalMinutes` 既定 1440 = 24 時間）が過ぎたもの。版が無ければすぐ。条件の定義（例外の人の変更を含む、`user_group_definitions.updated_at`）を最後の版の開始より後に直したグループもすぐ（書きかけの版は古い条件なので捨てて新しい版から）。cron は毎時なので、細かい間隔は次の毎時に丸まる
- 計算: 保存した条件の木を SQL にし（heavy の部品も使える）、削除されていない利用者を id の昇順に束ごと（`recompute.batchSize`）に新しい版へ書く。条件の時刻の基準は版の計算の開始（何回に分けて書いても 1 つの時点の一員）。締切（`recompute.budgetMs`）で止まれば次の回に `resume_after` から続ける。版の行を `FOR UPDATE SKIP LOCKED` で取るので並走する実行と重ならない
- 切り替え: 書き終えたら 1 つの取引で版を ready（`computed_at`・`member_count`）にし、`current_version` を切り替え、今の版と 1 つ前の版を残して他の版を消す。読む側は切り替えの commit まで前の版を読む
- 失敗: 条件が壊れた・人数の上限を超えた・書く途中の誤り = 版を failed（理由を `error`）、今の版はそのまま。失敗の版は一番新しい 1 つだけ残す。次の期限でもう一度計算する
- 結果: `{ checked, due, switched, failed, incomplete, budgetExhausted }`（`task_runs` に残る）

## 管理の API（`/api/admin/user-groups/**`、`userGroupAdmin` = `services/server/admin`）

- どの口も `createApiRoute` の access `{ roleCategories: ["admin"] }` + 門 `userGroups`（閉なら 404）。service でも管理者か system かを確かめる（403）。返す形は表示名を先に（`kindLabel`・`statusLabel`、内部の鍵は値としてだけ）
- `GET /api/admin/user-groups`（`kind`・`status` 既定 active・`cursor`・`limit` 1〜50 既定 20、新しい順）→ `{ items, nextCursor }`。例外の持ち主付きのグループは出さない
  - 人数 `count: { value, state }`: 静的 = 一員の数・定期計算 = 今の版の `member_count`（`counted`、版が無ければ `none`）、動的 = その場で数える（`estimated`、1 件 `admin.listCountTimeoutMs` 1 秒・1 ページ合計 `admin.listCountBudgetMs` 3 秒。遅い・尽きた・壊れた条件・しまった = `not_computed`）
  - 定期計算は `recompute: { intervalMinutes, defaultIntervalMinutes, lastComputedAt, lastFailure: { at, reason } | null（今の版より新しい失敗）, computing }`
- `POST /api/admin/user-groups` 作る `{ name, description?, kind, definition?, recomputeIntervalMinutes? }`（動的・定期計算は定義が要る、静的は持たない。間隔は 60〜43200 分か null）
- `GET /api/admin/user-groups/[id]` 1 件 = 一覧の形 + `definition`（例外の包みを外した元の定義）・`heavy`・`notices`（重い条件の 1 人の確かめ、定期計算の反映の時期・版が無い）・`exceptions: { includeCount, excludeCount }`（静的は null）
- `PATCH /api/admin/user-groups/[id]` 直す（名前・説明・種類・定義・間隔）。種類は**動的 ⇄ 定期計算だけ**（定期計算 → 動的は版を消す。動的 → 定期計算は次の cron が計算するまで版なし）。静的との間は 409（新しいグループを作る）。しまったグループは 409
- `POST /api/admin/user-groups/[id]/archive` しまう（しまったものはそのまま返す）
- 定義の検査: `checkUserGroupDefinition`（部品の鍵と引数・上限）で `has_heavy` を保存。「静的グループの一員」が指せるのは使える（active）静的グループで、例外の持ち主付きでないものだけ（400）。heavy を含む動的は保存できるが `notices` に「1 人ずつの確かめはできない（定期計算にすれば使える）」
- `POST /api/admin/user-groups/estimate` 見込みと試しの一覧 `{ definition }`（保存しない）か `{ groupId }` → `{ count, memberLimit, overLimit, heavy, sample: [{ id, name }] }`（メールは返さない。`evaluation.sampleLimit` 件、時間の上限で 503）
- `PUT /api/admin/user-groups/[id]/exceptions` 例外の人 `{ include?: { add?, remove? }, exclude?: { add?, remove? } }`（動的・定期計算だけ、静的は 409）
  - 初めての時に持ち主付きの静的グループ 2 つ（「<名前> の足す人」「<名前> の外す人」、`owner_group_id` = グループ）を作り、保存する定義を `(元の定義 or 足す人の一員) and not 外す人の一員` に包む（`admin/exceptions.ts`。どれが足す人・外す人かは包んだ木だけが持つ）。定義を直しても包みは保つ
  - 足す人に入れた人は外す人から外れる（逆も）。人数の上限は静的グループと同じ（409）。持ち主のグループを消すと一緒に消える（FK cascade）
  - 定期計算のグループは定義の時刻を進めるので、次の cron で計算し直す（`notices` に反映の時期）
- `POST /api/admin/user-groups/static` 静的グループを作る `{ name, description?, from }`、`POST /api/admin/user-groups/[id]/members` 一員 `{ mode: "add", userIds }` | `{ mode: "replace", from }`
  - `from` = `{ type: "users", userIds }`（選んだ利用者）| `{ type: "group", groupId }`（別のグループの今の一員、どの種類でも）| `{ type: "tag", tagId }`（タグの今の持ち主）
  - 1 回の要求の予算は `admin.freezeBudgetMs`（50 秒、route の `maxDuration` 60 秒の内側）。終わらなければ `members.status: "incomplete"`（前の一員のまま。作ったばかりなら空）を返すので、**画面が `[id]/members { mode: "replace", from }` を同じ `from` で送り直す**と置き換えの下書きの続きから書く（呼ぶたびに少なくとも 1 束は進む。サーバーは元を覚えない）
  - 人数の上限は 409（置き換えは下書きを消す、足すは書かない）
- 一員と例外の人の一覧・一員を外す（静的グループの一員の画面・例外の人を外す操作が使う）
  - `GET /api/admin/user-groups/[id]/members?cursor&limit` 静的グループの一員 → `{ items: [{ id, name }], nextCursor }`（表示名、利用者 id の順のカーソル、`limit` 1〜100 既定 50。静的でないグループは 409）
  - `POST /api/admin/user-groups/[id]/members { mode: "remove", userIds }` → `{ memberCount }`（静的でないグループは 409）
  - `GET /api/admin/user-groups/[id]/exceptions?side=include|exclude&cursor&limit` 例外の人 → `{ items: [{ id, name }], nextCursor }`（`limit` 1〜100 既定 50、例外がまだ無ければ空。静的グループは 409）
- `GET /api/admin/user-groups/criteria` 条件の部品の一覧 `{ criteria: [{ key, label, description, weight, weightLabel, fields }], options: { roles, statuses, tags, staticGroups }, kinds }`。`key` は定義の木の値としてだけ使い、画面は `label` を出す。選択肢を画面に任せていた欄（`hasTag` の `tagIds`・`inStaticGroup` の `groupId`）は `fields` にも選択肢を入れて返す（タグと静的グループは `admin.optionsLimit` 500 件まで、例外の持ち主付きは出さない）
- 監査（`auditLogger.record`、`targetType` `user_group`、操作した管理者が actor）: `user_group.group.created` / `updated` / `archived`・`user_group.exceptions.updated`・`user_group.members.replaced`（置き換え終えた時）/ `added`。metadata は名前・種類・数（利用者 id は入れない）。fork の system の task が静的グループへ書く口を直に呼んでも監査の行は書かない

## 管理画面（`/admin/user-groups`）

- 住所: `src/app/admin/(protected)/user-groups/page.tsx`（1 行スイッチ）→ `_screen/AdminUserGroupListScreen.tsx` + `_screen/loader.ts`（access 管理者カテゴリ、門 `userGroups` が閉なら notFound）。メニューの行 `admin/menu/items/userGroups.ts`（利用者の分類、門が閉なら住所ごと隠れる）
- 一覧（`components/AdminUserGroupList`、hook `useAdminUserGroupList`）: 種類・状態（既定 使用中。保管は選んだ時だけ）で絞る無限スクロール（カーソル）。行（`common/UserGroupRow`）= 名前・種類の表示名・人数（`counted` 人 / `estimated` 約 N 人 / `not_computed` 数えていない / `none` まだ無い）・定期計算の間隔と最後の計算と失敗（`common/UserGroupRecomputeStatus`）。「新しく作る」と行で作る・直すモーダル
- 作る・直すモーダル（`components/AdminUserGroupModal`、hook `useUserGroupModal` + `useUserGroupForm`。TabbedModal、書きかけ・固定の途中で閉じる時は `confirmOnClose`、ページの移動は `useUnsavedGuard`）
  - 基本: 名前・説明・種類（作る = 動的・定期計算・固定、直す = 動的 ⇄ 定期計算だけ）・定期計算の間隔（既定 / 1 時間〜7 日）と最後の計算・失敗の理由・サーバーの `notices`。固定を作る時は一員の元（`common/UserGroupStaticSourceFields`: 選んだ人 / タグを持つ今の人 / 固定のグループの今の一員）
  - 条件（動的・定期計算）: 条件の組み立て（`common/UserGroupConditionBuilder`、hook `useUserGroupConditionBuilder`）・重い条件の注意（動的で heavy を含む = 1 人ずつの確かめに使えない、定期計算をすすめる）・人数の見込みと試し（`common/UserGroupEstimateView`、hook `useUserGroupEstimate`: 押した時だけ保存しない定義を数え、時間の上限などの理由はサーバーの言葉のまま）
  - 一員（固定）: 一員の一覧（表示名、カーソル）と、利用者を選ぶ部品（user の `UserAsyncMultiSelect`）で足す・1 人ずつ外す（`common/UserGroupMemberList`、hook `useUserGroupStaticMembers`）
  - 例外の人（動的・定期計算）: 入れる人・外す人の 2 つの一覧と足す・外す（`common/UserGroupExceptionsEditor`、hook `useUserGroupExceptions`）と「今の人で固定」（今の一員で新しい固定のグループを作る。元のグループは残る、D51）
  - 下の帯: 保管（ConfirmPopover）・保存（直す = 変えた欄だけ PATCH。読むだけの条件は作り直さない限り送らない）。作った後は同じモーダルでその 1 件を直す形に変わる
- 条件の組み立て（2 段まで）: 根の組（すべて満たす and / どれか 1 つを満たす or）の中に条件と組、組の中は条件だけ。どの条件・組にも「当てはまらない人」（not）。条件は部品の `label` で選び、引数の欄は部品の `fields` を FieldRenderer で描く（`common/UserGroupCriterionFields` + hook `useUserGroupCriterionArgs`: 日時は ISO の文字、空の欄は落とす。選択肢は条件の部品の一覧の API の label）。画面で組めない深い定義（3 段以上・not の重なり）は読むだけで出し、「作り直す」で空の組から組む
- 固定の流れ（hook `useUserGroupFreeze`、モーダルの hook が持つ）: `POST static` の後、`members.status` が `incomplete` の間は同じ `from` で `[id]/members { mode: "replace" }` を自動で送り直し、進み具合（書いた人数）を出す（`common/UserGroupFreezeProgress`）。閉じると止める（グループは残り、同じ元で入れ替えれば続きから）
- 利用者一覧の一括操作（user の受け口 `adminBulkActions` の項目 `userGroupCreate` / `userGroupAdd`、一般の一覧、門 `userGroups` が閉なら出ない）: 作成関数 `bulkCreateUserGroupAction`（選んだ人で固定のグループを作る、名前・説明、送り直しは固定の流れ）・`bulkAddToUserGroupAction`（使用中の固定のグループを名前で選んで足す、hook `useAddToUserGroup`）は `components/AdminUserGroupBulkActions`。どのドメインの一覧の項目からも使える（選んだ記録の id = 利用者 id の一覧）。断られた理由（人数の上限など）はサーバーの言葉のまま
- 部品と hook は公開（hook の入口 `hooks/index.ts`、部品は `components/<Name>` / `components/common/<Part>`）。入れ物は hook を呼んで部品を並べるだけ。fork は自分の画面に同じ部品・モーダルを置ける。内部の鍵・id は画面に出さない（D94）
- client service: `services/client/userGroupAdminClient.ts`（axios + normalizeHttpError、型は server の DTO と入力の zod を型だけ読む）

## 設定（`config.ts`、上書き `src/config/features/userGroup.config.ts`）

- `memberLimit`（既定 100,000、D102）: グループ宛ての送信が送り始めに書き出す人数と、静的グループに入れる人数の上限。超える時は送る前・作る前に理由つきで止める（黙って途中で切らない）
- `definition.maxNodes`（既定 50）・`definition.maxDepth`（既定 6、根 = 1）
- `evaluation.timeoutMs`（既定 10,000）・`evaluation.listLimitMax`（既定 1,000）・`evaluation.sampleLimit`（既定 20）
- `write.batchSize`（既定 1,000）: 静的グループへ書く口の 1 つの束の人数
- `recompute.budgetMs`（既定 240,000）・`recompute.batchSize`（既定 1,000）・`recompute.defaultIntervalMinutes`（既定 1,440）
- `admin.listCountTimeoutMs`（既定 1,000）・`admin.listCountBudgetMs`（既定 3,000）・`admin.freezeBudgetMs`（既定 50,000）・`admin.optionsLimit`（既定 500）

## 門 `userGroups`（`src/featureGate/rules/userGroups.ts`、既定 閉）

- ドメイン `core/userGroup` ごと閉じる: 表・汎用 API・cron・管理画面 `/admin/user-groups` と API `/api/admin/user-groups`
- 閉の時、評価の口は「使えない」を返す（1 人の確かめを黙って false・全員に置き換えない）。グループを使う機能は自分の依存としてこの門を見て、閉ならグループの選択肢を出さず、グループ宛ての送信は拒む
- fork が開ける値は `src/config/featureGate/switches.config.ts`

## 登録

- `services/server/domainEntry.ts`（手書き）: `userGroup` = 表 `user_groups`、access `INTERNAL_ONLY`（汎用 API に出さない。管理の API は専用の口）
- 表は `pnpm generate registry` が schemaRegistry に入れる。表・列を足したら `pnpm db:push` の後に `pnpm db:push:check` = 0
