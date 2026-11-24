# outbox — 送り箱

## Overview

- 外部への持続的な副作用(認証の外部提供元の同期・配信の通知など)を、業務の DB の更新と同じ取引で 1 行積み、コミットの後に届ける共通の部品(D23・D52)
- 表は `outbox_jobs` 1 つ(`entities/drizzle.ts`)。中身は自前の表で、pg-boss は使わない(比べと理由: `docs/journal/2026-11-24--next-starter--outbox-engine-choice.md`)
- 常設にしない(D22・D53): 機能の規則 `src/featureGate/rules/outbox.ts`(住所なし、既定は閉)が開いている時だけ開く。閉じている間は表を作らず(push の対象の外)、処理の項目の行は保留のまま
- 届け方は少なくとも 1 回・順序なし。処理(`handle`)は冪等に書く
- 保証は予算つきの定期処理 `outbox-dispatch`(毎分、1 本だけ)。失敗は指数の間隔で再試行し、上限で隔離する(消さない)。隔離は `pnpm task outbox:reprocess` で戻す
- 決まり(積む場所・payload・冪等・kind・保留・再処理): 札 `.claude/rules/items/domains/outbox.md`

## Usage

### 積む(業務の取引の中で)

```ts
import { enqueueOutbox, kickOutbox } from "@/domains/core/outbox/services/server";

const { id, duplicate } = await enqueueOutbox(tx, {
  kind: "auth.syncProvider",           // 処理の項目の kind
  payload: { v: 1, userId },           // 版の欄 v を持つ JSON、秘密を入れない
  idempotencyKey: `user:${userId}`,    // 同じ kind で同じ鍵は積まない
});
// コミットの後に
if (!duplicate) kickOutbox([id]);
```

### まとめて(積む → コミット → 押す)

```ts
import { withOutbox } from "@/domains/core/outbox/services/server";

await withOutbox(async ({ tx, enqueue }) => {
  await tx.update(/* 業務の更新 */);
  await enqueue({ kind: "auth.syncProvider", payload: { v: 1, userId }, idempotencyKey: `user:${userId}` });
});
```

### 処理を差す(項目)

```ts
// src/domains/<自分のドメイン>/plugs/outboxHandlers/<名前>.ts
import { z } from "zod";
import type { OutboxHandler } from "@/domains/core/outbox/points";

export const handler: OutboxHandler<{ v: number; userId: string }> = {
  kind: "<自分のドメイン>.syncProvider",
  schema: z.object({ v: z.number(), userId: z.string() }),
  async handle(payload, ctx) {
    // ctx.id を提供元の冪等の鍵に使う。失敗は投げる
  },
};
```

- 送り箱を使う機能の規則は `dependsOn: ["outbox"]`(か同じドメインを挙げる)

### 隔離を戻す(運用)

```bash
pnpm task outbox:reprocess -- --kind auth.syncProvider   # kind で(カンマで複数)
pnpm task outbox:reprocess -- --id <id>[,<id>...]        # 行で
pnpm task outbox:reprocess -- --all                      # 隔離の全部
```

- 戻した行は次の定期処理が届ける。直す前に流すと同じ失敗で再び隔離される(試行は 0 から数え直す)
- 見るのは `outboxStats()`(kind ごとの待ち・隔離・処理の項目の状態)

## API

- `enqueueOutbox(tx, { kind, payload, idempotencyKey, notBefore? })` → `{ id, duplicate }`: tx は必須。kind の項目が無い・payload に数の `v` が無い・項目の `schema` に合わない時は投げる。同じ (kind, idempotencyKey) が在れば積まずにその id と `duplicate: true`
- `kickOutbox(ids)`: その行だけをコミットの後に Next の `after()` で 1 回動かす。投げない・待たない・保証しない(要求の外で `after()` が使えない時も 1 行の記録だけ)
- `withOutbox(fn)`: 1 つの取引で `fn({ tx, enqueue })` を回し、コミットの後に新しく積んだ行(重複でない物)を押して `fn` の値を返す。`fn` が投げれば巻き戻り、押さない
- `processOutboxRow(id)` → `"done" | "failed" | "quarantined" | "held" | "skipped"`: 1 行を処理する唯一の入口(押す・定期処理の両方。定期処理は束で取った行を同じ処理 `processClaimedRow` に渡す)。時の来た pending(か貸しの切れた running)を `FOR UPDATE SKIP LOCKED` で取り、門で絞った処理の項目を呼ぶ
  - 届けた = done
  - 投げた = 試行を 1 足し、`backoff` の秒の後を次の時刻に(failed)。試行が `maxAttempts` に達したら隔離(quarantined、行は消さない)
  - 未設定の基底(`isBackendNotConfiguredError`)で投げた = 試行を数えず次の時刻だけ延ばす(held、隔離しない)
  - 処理の項目のドメインが閉じている = 数えずに戻す(held)
  - 取れない(時が来ていない・他が取った・済み)= skipped
- `runOutboxDispatch(report?)` → `{ locked, done, failed, quarantined, held, truncated, alerts }`: 定期処理 1 回(cron `outbox-dispatch` だけが呼ぶ)。`report` = 失敗の記録の書き手(task.ts が `@/wiring/serverErrorReport` を渡す)
- `outboxStats()` → `[{ kind, pending, oldestWaitSeconds, quarantined, handler }]`: kind ごとの待ち(pending と running)・一番古い待ちの積んでからの秒・隔離の数・処理の項目の状態(`open` / `closed` = ドメインが閉じて保留 / `none` = 項目が無い)
- `outboxThresholdHits(stats, thresholds)`: しきい値を超えた kind と指標(純関数、0 のしきい値は見ない)。記録の誤りは `OutboxThresholdExceededError`
- `reprocessQuarantinedOutbox({ kinds?, ids? })` → `{ reprocessed }`: 隔離の行を待ちへ戻す(試行 0・今すぐ)。隔離でない行は触らない(何度流しても同じ)
- 型(`@/domains/core/outbox/points`): `OutboxHandler<P>` = `{ kind: "<地区>.<動作>", schema, handle(payload, ctx), maxAttempts?, backoff? }`、`OutboxHandlerContext` = `{ id, attempt }`、`OutboxBackoff` = `{ baseSeconds, maxSeconds? }`(指数: baseSeconds × 2^(試行 − 1)、maxSeconds で頭打ち)、`OutboxPayload`
- 表 `outbox_jobs`: `status` = pending / running / done / quarantined、`attempts`・`next_attempt_at`・`lease_until`・`last_error`・`done_at`・`quarantined_at`。一意 (kind, idempotency_key)、索引 (status, next_attempt_at)・(kind, status)

## Extension

- 増設点 `outboxHandlers`(型 3、`extensionPoints.ts`): 項目は差す側の `<ドメイン か lib>/plugs/outboxHandlers/<名前>.ts` の `export const handler`。一覧は生成物 `extensions/outboxHandlers.ts`(`pnpm generate extensions`)
  - `kind` は字面で `"<項目を置いた地区>.<動作>"`。先頭が違う・字面で読めない・全体で重なる時は生成が止める(宣言の `keyPrefix: "district"`)
- 上書き(型 2、宣言 `overrideOf: ["maxAttempts", "backoff"]`): 上流の項目の隣の `<名前>.override.ts` の `export const override = { maxAttempts?, backoff? }`。ほかの鍵は `pnpm check extensions` が止める。上流は override を出さない
- 値(型 4): `src/config/domains/outbox.config.ts`(既定と型は `config.ts`)
  - `retry`: 項目が書かない時の `maxAttempts`・`backoff`(`baseSeconds`・`maxSeconds`)
  - `dispatch`: 定期処理の予算 `budgetMs`・1 束の行の数 `batchSize`
  - `thresholds`: 監視のしきい値 `pending`・`oldestWaitSeconds`・`quarantined`(0 = 見ない)・`noHandler`(項目の無い kind の行を記録するか)
- 開く: fork は `src/config/featureGate/switches.config.ts` で機能 `outbox` を開く(型 4)。開いた後の最初の `pnpm db:push` で表ができ、`pnpm generate cron` で `vercel.json` に `outbox-dispatch` が載る(閉じている間は載らない。Hobby では cron の本数に数える)

## Internals

- 依存は `services/server/outbox.ts` の `createOutbox` に渡す(表・取引・処理の一覧・after)。本物の束は `services/server/index.ts`(drizzle の `store.ts`、処理の一覧は使う時に遅れて読む: 項目が自分のサービスから送り箱を読んでも読み込みの輪にならない)
- 取る時の貸しは `OUTBOX_LEASE_MS`(5 分)。切れた running は次に取り直せる
- 定期処理(`services/server/dispatch.ts`、cron `src/app/api/cron/outbox-dispatch/`、毎分):
  - 1 本: 外の取引で `pg_try_advisory_xact_lock(hashtextextended('outbox:dispatch', 0))`。取れなければ待たずに `locked: true` で終わる。外の取引は行の鍵を持たず、取る・処理は別の接続(pool の既定 max 3 = 外の取引 1 + 取る 1 + 処理 1。処理が自分で取引を開くなら pool を見直す)
  - 取る: 開いた kind の時の来た行を `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT batchSize)` で running と貸しを付けて取る。閉じたドメインの kind・項目の無い kind の行は取らない(pending のまま、監視が `closed` / `none` と数える)
  - `runBudgetedBatches` + `createDeadline(dispatch.budgetMs)`。締切で残した行は次の回(`truncated`)。メンテナンス中は飛ばす(`maintenance: "pass"` を書かない: 次の回で追いつく)
  - 最後に `outboxStats()` をしきい値と比べ、超えた kind ごとに 1 行を失敗の記録へ(scope `cron`・name `outbox-dispatch`、extra に kind と超えた指標の値)
  - 二重に動いても(鍵)・重なっても(SKIP LOCKED と貸し)・抜けても(次の回が拾う)壊れない。handle は冪等(少なくとも 1 回)
- 押す(`kickOutbox`)が先に届けるので、定期処理は保証だけ。Hobby の 1 日 1 回でも遅れるだけで壊れない
- 未設定の基底の保留は隔離しない(env が入れば届く)。長く続けば監視の `oldestWaitSeconds` が知らせる
- messaging の内部の事件(message_events)は吸収しない(D23)。形だけ同じ(同じ取引で書く・SKIP LOCKED)

## Verification

- `pnpm test src/domains/core/outbox/services/server/outbox.test.mts`(偽物の表・取引・after で積む・重複・withOutbox の順・押すは投げない・1 行の処理・再試行の間隔と頭打ち・上限で隔離・未設定の基底と閉じたドメインの保留・定期処理の 1 本と二重・締切・再処理が何度でも同じ・監視としきい値)
- kind の先頭の検査は `pnpm test scripts/structure/extensions/extensions.test.mjs`(keyPrefix)
