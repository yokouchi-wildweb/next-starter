# userGroup（ユーザーグループ）

利用者の集まり（グループ）を名前つきで持つ core ドメイン（評議会の決定 D96〜D104）。連絡の宛先・限定ページ・ガチャの参加資格など、送ること以外にも多くのドメインが使う。呼び方は「ユーザーグループ」に揃え、「オーディエンス（audience）」の語は使わない（D100）。

今あるもの: 表・条件の部品の受け口と上流の部品 6 つ・条件の定義の木の検査・評価の口（count・isMember・listMemberIds・evaluate）・静的グループへ書く口（replaceMembers・addMembers・removeMembers）・定期計算の cron（user-group-recompute）・門・設定。管理画面は次の指令で足す。

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
  - 締切（既定 = 今 + `recompute.budgetMs`）で止まれば `incomplete`（前の一員のまま）。同じ供給でもう一度呼ぶと `resume_after` から続ける。`restart: true` は下書きを捨てて最初から
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
- 期限: 使える（active）定期計算のグループのうち、書きかけの版がある（続きを書く）か、最後の版の計算の開始から間隔（`recompute_interval_minutes`、null = `recompute.defaultIntervalMinutes` 既定 1440 = 24 時間）が過ぎたもの。版が無ければすぐ。cron は毎時なので、細かい間隔は次の毎時に丸まる
- 計算: 保存した条件の木を SQL にし（heavy の部品も使える）、削除されていない利用者を id の昇順に束ごと（`recompute.batchSize`）に新しい版へ書く。条件の時刻の基準は版の計算の開始（何回に分けて書いても 1 つの時点の一員）。締切（`recompute.budgetMs`）で止まれば次の回に `resume_after` から続ける。版の行を `FOR UPDATE SKIP LOCKED` で取るので並走する実行と重ならない
- 切り替え: 書き終えたら 1 つの取引で版を ready（`computed_at`・`member_count`）にし、`current_version` を切り替え、今の版と 1 つ前の版を残して他の版を消す。読む側は切り替えの commit まで前の版を読む
- 失敗: 条件が壊れた・人数の上限を超えた・書く途中の誤り = 版を failed（理由を `error`）、今の版はそのまま。失敗の版は一番新しい 1 つだけ残す。次の期限でもう一度計算する
- 結果: `{ checked, due, switched, failed, incomplete, budgetExhausted }`（`task_runs` に残る）

## 設定（`config.ts`、上書き `src/config/features/userGroup.config.ts`）

- `memberLimit`（既定 100,000、D102）: グループ宛ての送信が送り始めに書き出す人数と、静的グループに入れる人数の上限。超える時は送る前・作る前に理由つきで止める（黙って途中で切らない）
- `definition.maxNodes`（既定 50）・`definition.maxDepth`（既定 6、根 = 1）
- `evaluation.timeoutMs`（既定 10,000）・`evaluation.listLimitMax`（既定 1,000）・`evaluation.sampleLimit`（既定 20）
- `write.batchSize`（既定 1,000）: 静的グループへ書く口の 1 つの束の人数
- `recompute.budgetMs`（既定 240,000）・`recompute.batchSize`（既定 1,000）・`recompute.defaultIntervalMinutes`（既定 1,440）

## 門 `userGroups`（`src/featureGate/rules/userGroups.ts`、既定 閉）

- ドメイン `core/userGroup` ごと閉じる: 表・汎用 API・cron・管理画面 `/admin/user-groups` と API `/api/admin/user-groups`
- 閉の時、評価の口は「使えない」を返す（1 人の確かめを黙って false・全員に置き換えない）。グループを使う機能は自分の依存としてこの門を見て、閉ならグループの選択肢を出さず、グループ宛ての送信は拒む
- fork が開ける値は `src/config/featureGate/switches.config.ts`

## 登録

- `services/server/domainEntry.ts`（手書き）: `userGroup` = 表 `user_groups`、access `INTERNAL_ONLY`（汎用 API に出さない。管理の API は専用の口）
- 表は `pnpm generate registry` が schemaRegistry に入れる。表・列を足したら `pnpm db:push` の後に `pnpm db:push:check` = 0
