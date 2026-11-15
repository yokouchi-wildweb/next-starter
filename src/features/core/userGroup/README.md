# userGroup（ユーザーグループ）

## Overview

利用者の集まり（グループ）を名前つきで持ち、何度も使う core ドメイン。連絡の宛先・限定ページ・参加資格など、送ること以外にも多くのドメインが使う。呼び方は「ユーザーグループ」に揃え、ほかの呼び名は使わない。

- グループであるもの: 名前をつけて何度も使う集まり（「VIP」「30 日ログインしていない人」「キャンペーンの当選者」）
- グループでないもの: 出来事に伴う宛先（ある人のフォロワー・欲しい物の登録者・ある予約の人）。その機能が自分で利用者を引き、連絡なら選んだ宛先（`recipients`）として送る。グループを作って渡さない
- user に列も表も足さない独立したドメイン。門 `userGroups`（既定 閉）がドメインごと閉じる
- 母集団は削除されていない利用者。利用できる状態か（停止・休会・デモ）は条件の部品「状態」か使い手が見る（連絡はグループの一員にも user の「利用できる利用者」の述語をかける）

3 つの種類（`kind`）:

- `dynamic`（動的）: 条件の定義を保存し、使う時にその場で引く
- `scheduled`（定期計算）: cron が条件で計算し、計算し終えた版を一度に切り替える。使う時は今の版を読む。重い条件はこちらにする
- `static`（固定・静的）: 利用者 id の並びそのもの。画面で選んだ人・タグを持つ今の人・別のグループの今の一員から作る。SQL で書けない条件は fork の task が書く

状態（`status`）は `active`（使用中）/ `archived`（保管: 残すが選択肢に出さず、新しい宛先・条件に使えない）。動的・定期計算には「例外の人」（条件に関わらず足す人・外す人）を付けられる。

上限:

- 人数 `memberLimit` 100,000: グループ宛ての送信が送り始めに書き出す人数と、静的グループに入れる人数の上限。超える時は送る前・作る前に理由つきで止める（黙って途中で切らない）
- 評価の時間 `evaluation.timeoutMs` 10 秒: 数え・見込み・動的の引きの 1 文の時間。超えると 503（条件を絞るか定期計算にする）
- 条件の定義の木: 節 50 まで・深さ 6 まで（管理画面で組めるのは 2 段まで、それより深い定義は読むだけ）

## Usage

サーバーから使う口は `@/features/core/userGroup/services/server` の `userGroupEvaluator`（評価）と `staticMemberWriter`（静的グループへ書く）。`userGroupService` も同じ口を持つ。形の詳細は `API.md`。

```ts
import { userGroupEvaluator } from "@/features/core/userGroup/services/server";

const { count, overLimit } = await userGroupEvaluator.count({ groupId });
const ok = await userGroupEvaluator.isMember(groupId, userId); // 限定ページ・参加資格
const page = await userGroupEvaluator.listMemberIds(groupId, { cursor, limit: 500 }); // 利用者 id の昇順の keyset
```

- 門 `userGroups` が閉なら評価の口は 404 を投げる（黙って false や全員に置き換えない）。グループを使う機能はこの門を自分の依存として見て、閉ならグループの選択肢を出さず、グループを使う操作を断る
- 重い部品を含む動的グループに 1 人の確かめ（`isMember`）はできない（409）。そのグループは定期計算にする
- 出来事に伴う宛先をその場の条件で引きたい時は保存しない定義の `evaluate(definition)` を使う（グループは作らない）

連絡の宛先として使う（messaging）:

- `sendMessageToMany` / 管理の送信の宛先 `target: { type: "group", groupId }`。送り始めに門・保管・壊れた条件・人数の上限を確かめ、だめなら回を作らずに理由を返す
- 送り始めの後、cron が 1 つの時点の一員を回の受信者の一覧へ 1 文で書き出し、書き終えてからその一覧だけに送る（送る途中でグループが変わっても宛先は変わらない）。定期計算のグループは送り始めの今の版を固定する
- 詳しくは `src/features/core/messaging/README.md`

fork の task で静的グループを書く（SQL で書けない条件: 外のサービスの値・重い集計）:

```ts
import { runAsSystem } from "@/lib/audit";
import { staticMemberWriter } from "@/features/core/userGroup/services/server";

const result = await runAsSystem(() =>
  staticMemberWriter.replaceMembers(groupId, async (after, limit) => myVipUserIds({ after, limit })),
);
if (result.status === "incomplete") return { ok: true, pending: true }; // 次の実行で同じ呼び出しを繰り返すと続きから
```

- 書いた静的グループは、動的・定期計算の条件から部品「静的グループの一員」で使える
- 管理画面（`/admin/user-groups`）は一覧・作る / 直す・人数の見込みと試し・例外の人・静的グループの一員・保管ができる。利用者一覧の一括操作から「選んだ人で固定のグループを作る」「固定のグループに足す」もできる（門が閉なら出ない）

## API

評価の口（`count` / `isMember` / `listMemberIds` / `evaluate`、連絡の送信の固定の `sendTarget` / `memberWhere`）・静的グループへ書く口（`replaceMembers` / `addMembers` / `removeMembers`）・管理の API（`/api/admin/user-groups/**`）・管理画面の公開の部品と hook の形は `API.md`。

## Extension

### 条件の部品（受け口 `criteria`）

`criteria/<名前>.ts` に `export const criterion`（型 `UserGroupCriterion`、`@/features/userGroup/types`）を置き、`pnpm generate extensions` で一覧に入れる。fork も同じ受け口に項目として足す。

```ts
// criteria/registeredDays.ts
import { sql } from "drizzle-orm";
import { z } from "zod";

import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

const args = z.object({ minDays: z.number().int().min(0) }).strict();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "registeredDays",
  label: "登録からの日数",
  description: "登録してから指定の日数以上たった人",
  args,
  fields: [{ name: "minDays", label: "何日以上", formInput: "numberInput" }],
  weight: "cheap",
  where({ minDays }, { now }) {
    return sql`${UserTable.createdAt} <= ${new Date(now.getTime() - minDays * 86_400_000).toISOString()}`;
  },
};
```

- `key`: 定義の木の葉 `{ part: key, args }` が指す鍵（一意。画面には出さない）
- `label` / `description?`: 管理画面に出す名前と説明
- `args`: 引数の zod。定義を保存する時と評価する時に通す
- `fields`: 管理画面の欄（フォームの欄の型 `FieldConfig`、`name` = `args` の鍵）。選択肢が要る欄は `options` を持たせる
- `weight`: `cheap`（1 人の確かめ・その場の評価に使える）/ `heavy`（重い。含む動的グループは 1 人の確かめを拒み、定期計算にすれば使える。動的のまま保存はできる）
- `where(args, { now })`: users の行への SQL の述語。他の表は EXISTS の副問い合わせで書く。1 回の評価は全部の部品に同じ `now` を渡す
- 部品は SQL の述語だけを返す（利用者 id を集める関数は書かない）。raw SQL に Date を埋めない（`.toISOString()` か drizzle の演算子に渡す）
- 部品が読む列には索引が要る（全員を相手に毎回引くため）。索引を足したら `pnpm db:push` の後に `pnpm db:push:check` = 0（`.desc()` を使い、普通の列と式を 1 つの索引に混ぜない）。users の status / deleted_at / created_at / last_authenticated_at / role と user_to_user_tag の user_tag_id には索引がある
- SQL で書けない条件は部品にしない: fork の task が静的グループへ書き（Usage）、条件からは部品「静的グループの一員」で使う

上流の部品（どれも cheap）:

- `role`（ロール）: `{ roles }` のどれか
- `status`（状態）: `{ statuses }` のどれか。利用できる人だけにしたい時は「有効」を選ぶ
- `signupPeriod`（登録の時期）: `{ from?, to?, withinDays? }`（1 つ以上、重ねると and。`withinDays` = 評価の時刻から N 日以内）
- `lastLoginPeriod`（最後のログインの時期）: 同じ形 + `notWithinDays?`（N 日ログインしていない。一度もログインしていない人も含む）
- `hasTag`（タグ）: `{ tagIds, match: "any" | "all" }`
- `inStaticGroup`（静的グループの一員）: `{ groupId }`。指せるのは使用中の静的グループ（保存の時に確かめる）

### 設定（`config.ts`、上書き `src/config/features/userGroup.config.ts`）

- `memberLimit`（既定 100,000）
- `definition.maxNodes`（50）・`definition.maxDepth`（6、根 = 1）
- `evaluation.timeoutMs`（10,000）・`evaluation.listLimitMax`（1,000: `listMemberIds` の 1 回の件数の上限）・`evaluation.sampleLimit`（20: 見込みの試しの件数）
- `write.batchSize`（1,000: 静的グループへ書く 1 束の人数）
- `recompute.budgetMs`（240,000: 定期計算の 1 回の実行の予算）・`recompute.batchSize`（1,000）・`recompute.defaultIntervalMinutes`（1,440: グループの間隔が未指定の時）
- `admin.listCountTimeoutMs`（1,000: 一覧で動的グループを数える 1 件の時間）・`admin.listCountBudgetMs`（3,000: 1 ページの合計）・`admin.freezeBudgetMs`（50,000: 静的グループを作る・置き換える 1 回の要求の予算）・`admin.optionsLimit`（500: タグ・静的グループの選択肢の件数）

### 門と cron

- 門 `userGroups`（`src/featureGate/rules/userGroups.ts`、既定 閉）: 表・汎用 API・cron・管理画面 `/admin/user-groups` とその API がまとめて閉じる。fork が開ける値は `src/config/featureGate/switches.config.ts`
- 定期計算の cron `user-group-recompute`: 毎時 55 分（UTC）。Vercel Hobby（`pnpm generate cron -- --plan hobby`）では 1 日 1 回になり、グループの間隔が 1 日より短くても 1 日 1 回しか計算しない

## Internals

表・種類ごとの引き方・条件の木の検査と SQL への組み立て・時間の上限・定期計算の版と切り替え・静的グループの置き換えの下書き・例外の人の包み方・登録は `Internals.md`。

## Verification

- `pnpm test src/features/core/userGroup`（部品・木の検査・組み立て・hook と部品・門）
- 実 DB（戻す取引）: `pnpm test --db src/features/core/userGroup/services/server/evaluation/evaluator.db.test.ts`・`.../writes/staticMembers.db.test.ts`・`.../recompute/recompute.db.test.ts`・`.../admin/adminService.db.test.ts`
- 管理の API の route: `pnpm test src/app/api/admin/user-groups/route.test.mts`
- 門: `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`
- 表・索引を変えた時: `pnpm db:push` の後に `pnpm db:push:check` = 0

## Related

- `src/features/core/messaging/README.md`: グループ宛ての送信（送り始めの固定・受信者の一覧）
- `src/features/core/user/README.md`: 利用できる利用者の述語 `availableUserWhere`
- `src/featureGate/README.md`: 門とドメインの依存
- `scripts/structure/extensions/README.md`: 受け口と `pnpm generate extensions`
- `src/lib/cron/README.md`: cron と Hobby の周期
