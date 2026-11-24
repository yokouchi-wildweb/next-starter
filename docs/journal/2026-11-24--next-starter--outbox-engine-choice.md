# 2026-11-24 送り箱(outbox)の中身の選択: 自前の表 / pg-boss

> owner: next-starter

注文 12(計画書 02 の S1、D23 が実装の時点の比較に任せた選択)の記録。外部への持続的な副作用(認証の外部提供元の同期・配信の通知など)を DB の更新と同じ TX で積み、コミットの後に届ける共通の部品の中身を、自前の表と pg-boss で比べて選んだ。選択は自前の表(議会の決定 D52)。この記録はコードを書かない。表・コード・db:push は次の区切り(S2)で作る。

出典の記号: [pgb] = pg-boss の文書と源(npm の最新 12.39.0、2026-11-24 に読んだ物。インストールも実行もしていない)/ [next] = 入れてある next 16.4.6 の文書 / [repo] = このリポの file:line(合流地点 cd9537066 の時点)。

## 1. 比べ

### 同じ TX で積めるか

- 自前の表: 積むのは Drizzle の TX の中の素の insert。messaging の内部の事件(D47 の outbox)が同じ形で、元の状態の更新と同じ取引で `message_events` に書いている [repo `src/domains/core/messaging/services/server/events/internalEvents.ts:1-6`]
- pg-boss: できる。`send()` / `insert()` / `complete()` / `fail()` / `cancel()` / `deleteJob()` は呼ぶごとに `db` を受け(`fetch()` は文書に無い)、組み込みの `fromDrizzle(tx, sql)` がある。例は `db.transaction(async tx => { await tx.insert(...); await boss.send(q, data, { db: fromDrizzle(tx, sql) }) })` で、ORM の TX を巻き戻せば pg-boss の操作も戻る。文書は「node-postgres・postgres-js・bun-sql の driver に対応」 [pgb pgboss.io/api/adapters, pgboss.io/api/jobs, github timgit/pg-boss `src/adapters/drizzle.ts`]
  - このリポは drizzle-orm ^0.44.3 + postgres ^3.4.7 [repo `package.json:70,87`]。この組み合わせで同じ TX に積めるかは動かして確かめていない

### Vercel(サーバーレス)で worker 無しに cron と after() から動かせるか

- 自前の表: Vercel の cron → `createCronRoute`(門番が閉じた住所を飛ばす)→ `runBudgetedBatches` + `createDeadline` の形がすでにある [repo `src/lib/cron/runBudgetedBatches.ts:106,114,126`、`src/app/api/cron/messaging-subscribers/`]。常駐の物は要らない
- pg-boss: 手で回す API はある。`fetch(name, { batchSize })` → jobs、`complete()` / `fail()`、`drain(name?, { timeoutSeconds })`(cron・サーバーレス向け、登録した `work()` を空になるまで回す) [pgb github `docs/api/ops.md`, pgboss.io/api/workers]
  - ただし `start()` は pool を開く → schema を作り移行する → 管理のタイマー(queue の cache、2 秒の wip)→ 任意で LISTEN → supervisor → flow resolver → 任意で scheduler → instance の登録、と常駐を前提に順に立ち上げる。`supervise:false`・`schedule:false`・`migrate:false`・`registerInstance:false`(短命なら推奨)で切れるが、queue の cache と wip のタイマーは止める切り替えが見当たらない [pgb github `docs/api/constructor.md`, `src/index.ts` #doStart]
  - 組み込みの pool なら `start()` の前の `send` / `fetch` は "Database not opened" で投げる。自前の db adapter なら code に start の門は無いが、支えられた使い方ではない(community issue #518) [pgb github `src/db.ts`, issue #518]。queue は先に `createQueue` が要る
- after()(両方に共通の「コミット直後の 1 回」): Server Components・Server Functions・Route Handlers・Proxy で使え、ルートの maxDuration の間動き、応答が失敗・throw・notFound・redirect でも走る。サーバーレスでは `waitUntil` に乗る("In Next.js and Vercel, this is achieved using a primitive called waitUntil(promise)")。v15.1.0 から安定。自前のホストは graceful shutdown が要る [next `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md:8,50,54,64-66,236-252,302`、`self-hosting.md:267-271`]。リポにはまだ `after()` の使い手が無い
  - Vercel での実際の動き(このリポのプランの maxDuration)は文書だけで、動かしていない

### 閉じたドメインで表を作らずに済むか(D22)

- 自前の表: 表は drizzle の pgTable なので生成物 `src/registry/schemaRegistry.ts`(push の唯一の入口)に載り、`src/featureGate/node/gatedSchema.ts` の `applySchemaGate` が閉じたドメインの表を両側から外す(push の imports から外して作らない、tablesFilter に `!<表>` を足して既存を消さない)。db:push と push:check が使う [repo `src/registry/schemaRegistry.ts:1-5`、`src/featureGate/node/gatedSchema.ts:1-12`、`scripts/operations/db/push.ts:50-66`、`scripts/operations/db/check-schema-roundtrip.ts:40-58`]。定期処理も閉じた住所は proxy が 404、`createCronRoute` が skipped "closed" で返す [repo `src/proxies/featureGate.ts:15-30`、`src/lib/cron/createCronRoute.ts:93,113-116`]
- pg-boss: `start()` が専用の schema(既定 `pgboss`、`schema` で変更、`createSchema:false` で切る)を作って移行する。要るのは database の CREATE 権限。起動の外でも SQL を出せる(`getConstructionPlans` ほか、CLI `pg-boss migrate / plans --dry-run`、手で持つなら先の schema の変化を自分で追う)。v12 は `job` 表 1 つを `PARTITION BY LIST(name)` [pgb github `docs/install.md`, `docs/api/utils.md`, pgboss.io/api/queues]
  - このリポの側から見ると: pg-boss の物は drizzle の pgTable でないので schemaRegistry に載らず、gatedSchema にも見えない。db:push の `pushSchema` は drizzle-kit の既定 `schemaFilters ?? ["public"]` で、`pgboss` schema を作りも消しもしない [repo `scripts/operations/db/push.ts:66`、`node_modules/drizzle-kit/api.js`]。つまり「閉じれば表を作らない」を門で守れない

### 依存の重さ

- 自前の表: 足す依存は無い
- pg-boss 12.39.0: 展開 1,422,875 B(112 files)。依存 `pg ^8.23.1`・`cron-parser ^5.10.6`・`rrule-temporal ^2.3.0`・`serialize-error ^13.1.0`、peer `@opentelemetry/api ^1.9.0`(任意でない)、node >=22.12.0、PostgreSQL 13+。driver は node-postgres の自前の pool(max 10、adapter を渡さない時)。v12 は ESM [pgb registry.npmjs.org/pg-boss/latest, github README, releases 12.0.0]
  - このリポは postgres-js なので、pg と 2 つ目の pool が入る
  - LISTEN/NOTIFY は既定で切(`useListenNotify` false)、使うなら TX の pool を通さない専用の接続が要り、無ければ警告して polling [pgb github `docs/database-backends.md`]
  - Neon についての公式の記述は無い(community issue #518 の neon() HTTP adapter だけ)

### ライセンス

- 自前の表: リポのコード
- pg-boss: MIT [pgb registry.npmjs.org/pg-boss/latest]

### 表で見る(事実だけ)

| 項目 | 自前の表(リポの前例) | pg-boss 12.39 |
|---|---|---|
| 同じ TX で積む | drizzle の tx の insert(message_events と同じ) | `send(..., { db: fromDrizzle(tx, sql) })` |
| 取る | FOR UPDATE SKIP LOCKED + 貸しの列(messaging の sweep) | `fetch()`(中で SKIP LOCKED) |
| 再試行・隔離 | attempts + quarantined_at(messaging の購読) | 組み込みの retry / dead letter |
| 定期 | Vercel cron + createCronRoute + runBudgetedBatches | cron の route から fetch / complete か drain()。自前の scheduler は schedule:true とタイマー |
| schema | pgTable → schemaRegistry、gatedSchema が閉じる | 自前の `pgboss` schema を start() / CLI、push と門の外 |
| driver | postgres-js | pg の pool か adapter |
| 足す依存 | 無し | pg・cron-parser・rrule-temporal・serialize-error、peer @opentelemetry/api、node >=22.12 |
| ロック | pg_advisory_xact_lock(使う所で) | pg_advisory_xact_lock(移行) |

前例の場所 [repo]: 貸しを取る SKIP LOCKED = `src/domains/core/messaging/services/server/sweep/store.ts:4-7,92,118,159,186,318`・`admin/operationsStore.ts:54,107` / 消す SKIP LOCKED = auditLog `pruning.ts:72` ほか / 購読の走り手 = `messaging/services/server/subscribers/runSubscribers.ts:4-11,55-99,127,145`(per-subscriber の cursor・lagSeconds・batchSize・maxAttempts → quarantined_at・reprocessQuarantined)/ xact のロック = `sendMessage/throttleStore.ts:113`・`couponIssuerGrant issuance.ts:86`・`storageObject ledger/drizzleLedger.ts:31` ほか(共通のロックの部品は無く、各所が `tx.execute` で `pg_advisory_xact_lock`)

## 2. 選択(D52)

自前の表にする。

- D22(閉じたドメインは表も定期処理も作らない)を、今の門(schemaRegistry + gatedSchema + 生成の cron の住所)でそのまま守れる。pg-boss の schema は db:push と門の外で `start()` / CLI が作るので、閉じていても表ができうる
- Drizzle の TX にそのまま積める。足す依存は無い(pg と 2 つ目の pool、node >=22.12、peer の @opentelemetry/api が要らない)
- 動かし方がリポの前例(messaging の SKIP LOCKED・runBudgetedBatches・隔離と再処理)と同じ形で、Vercel の cron と after() だけで足り、止められないタイマーや常駐の起動の順を持ち込まない

### 採らなかった物: pg-boss

上の事実のとおり、TX で積む・再試行・dead letter・drain は揃っていて、文書の形(tx で積む・再送・隔離・即時 + 遅い保険)は D23 の公開の型と合う。採らないのは門の外の schema と常駐前提の仕組みのため。次の点は動かして確かめていない(採らないので確かめない): このリポの drizzle 0.44 + postgres-js での同じ TX の積み、`start()` 無しの `send`、Neon(pooler・HTTP driver)での動き、v10・v11 の違い。

## 3. 設計(置き場ごと)

公開の型と動きは D23 の決めたとおり(計画書 02 FIXED)。以下は自前の表に決めた後の置き場。

### ドメイン src/domains/core/outbox(上流だけ)

- 表を持つのでドメイン。`alwaysOpen` にしない(D22)。手書きのドメイン(domain.json を持たない core の形)
- messaging の内部の事件(message_events)は吸収しない(D23)。形を借りるだけ

### 表(`src/domains/core/outbox/entities/drizzle.ts` の 1 表、上流だけ)

- 名前: `outbox_jobs`(core/db.md の 63 字の内、FK は持たない)
- 列:
  - `id` uuid 主キー
  - `kind` text(`"<地区>.<動作>"`)
  - `payload` jsonb(版の欄 `v` を必ず持つ JSON、秘密を入れない)
  - `idempotency_key` text
  - `status` text(`pending` / `running` / `done` / `quarantined`)
  - `attempts` integer 既定 0
  - `next_attempt_at` timestamptz(積んだ時 = `notBefore ?? now()`、失敗の後 = 次の試行)
  - `lease_until` timestamptz null(running の貸しの期限。切れた running は取り直せる)
  - `last_error` text null(誤りの名前と文の先頭だけ。値・秘密を入れない)
  - `created_at`・`updated_at`・`done_at` null・`quarantined_at` null
- 索引:
  - 一意 `(kind, idempotency_key)`(同じ kind と鍵の重複は積まない → `{ id, duplicate: true }`)
  - 取る順 `(status, next_attempt_at)`(pending で時の来た物を古い順に。`.desc()` は使わない、式と列を混ぜない: core/db.md push_roundtrip)
  - 監視 `(kind, status)`
- 索引を足す時は push の往復(`pnpm db:push:check` が 0 文)を守る。db:push は最初に挙げる口の区切りの notice(D30)

### 公開の関数(`services/server`、上流だけ = 公開の手段)

- `enqueueOutbox(tx, { kind, payload, idempotencyKey, notBefore? })` → `{ id, duplicate }`: tx は必須。`kind` の項目が無ければ投げる。payload は項目の `schema` で確かめる。`ON CONFLICT (kind, idempotency_key) DO NOTHING` で重複を積まない
- `kickOutbox(ids)`: コミットの後に Next の `after()` でその要求が積んだ行だけを 1 回動かす。投げない・待たない・保証しない(保証は定期処理)
- `withOutbox(fn)`: 積む → コミット → 押す、をまとめる(`fn` が tx を受けて積んだ id を集め、コミットの後に kick)

### 増設点 outboxHandlers(`src/domains/core/outbox/extensionPoints.ts`)

- plugs の点、`change: "add"`、項目 = `<地区>/plugs/outboxHandlers/<名前>.ts` の `export const handler = { kind, schema, handle(payload, ctx), maxAttempts?, backoff? }`
  - `ctx.id` を提供元の冪等の鍵に使う(少なくとも 1 回・順序なし・handle は冪等)
- `kind` の先頭は項目を置いた地区の名前(`"<地区>.<動作>"`)。先頭が違えば `pnpm generate extensions` が止める(字面で読む)。kind は全体で一意
- 上書きの鍵: `overrideOf: ["maxAttempts", "backoff"]`(隣の `<名前>.override.ts`)
- 一覧は門番で閉じたドメインの項目を外す(`gate.plugs`)

### 定期処理(`src/app/api/cron/outbox-dispatch/`、1 フォルダ、上流だけ)

- `task.ts` + 1 行の `route.ts`(items/lib/cron.md cron_wiring)。`vercel.json` の crons は `pnpm generate cron` の出力
- 1 回ごとに `pg_advisory_xact_lock` で 1 本に絞る(D26)
- 行は `UPDATE … WHERE id IN (SELECT … WHERE status = 'pending' AND next_attempt_at <= now() OR (status = 'running' AND lease_until < now()) … FOR UPDATE SKIP LOCKED LIMIT n)` で貸しを付けて取る(messaging の sweep の形)
- `runBudgetedBatches` + `createDeadline` で予算の内だけ回す。メンテ中は飛ばす(`maintenance` を "pass" にしない)
- 成功 → done / 失敗 → attempts を 1 足し、`backoff`(既定は指数)で next_attempt_at、`maxAttempts` で quarantined(消さない)
- 二重に動いても・重なっても・抜けても、何度流しても同じ結果(D26)

### 保留(数えるだけ、失敗にしない)

- 処理の項目のドメインが閉じている行: 門番が一覧から外すので、取らずに pending のまま。attempts を減らさず、監視で「保留」と数える(D22)
- 処理が未設定の基底(`BackendNotConfiguredError` の子)で落ちた行: attempts を足さずに次の試行へ回し、保留と数える(D23)
- 項目の無い kind(消えた処理): 失敗にも隔離にもせず「処理なし」と数える

### 監視

- `outboxStats()`(services/server): kind ごとの待ち(pending)・最古の待ち時間・隔離の数・保留・処理なしを返す
- 定期処理の最後に、しきい値(config)を越えた kind を失敗の記録(serverErrorReport)へ 1 行
- しきい値の値は `src/config/domains/outbox.config.ts`(設定値の対置のファイル)

### 再処理の命令

- `pnpm task outbox:reprocess`(`src/domains/core/outbox/scripts/tasks/reprocess.ts`、`OneShotTask`): 隔離の行を kind・id で選んで pending に戻す(attempts を 0、next_attempt_at = now)。`stopKeys` を宣言する(core/scripts.md tasks)

### 機能の規則(D22)

- 上流はどの機能の規則も送り箱のドメインを挙げない = 閉じる。表は作られず、定期処理の住所は閉じる。フォークの作業は要らない
- 送り箱を使う機能が出たら、その機能の規則が `domains` に outbox を挙げて開く(最初に挙げる口の区切りで db:push の notice、D30)
- 注意(S2 で作る前に揃える前提): 今の `src/featureGate/ruleList.ts:226-236` の `closedDomainsOf` は「一覧のどの規則も持たないフォルダは閉じない(常設と同じ)」。CLAUDE.md DOMAINS_AND_FEATURES と D22 の「どの機能も挙げないドメインは閉じる」と逆で、このままでは規則の無い送り箱のドメインが開いて表が作られる(選ぶ点の検査を作った時の所見としても出した)。closedDomainsOf を決まりに揃えるか、既定で切の規則を出すかは S2 の前に決める

## 4. 変更形式(フォークが書く場所)

| 場所 | 型 |
|---|---|
| 処理の項目 `<地区>/plugs/outboxHandlers/<名前>.ts` | 3 add(増設点 outboxHandlers) |
| 上流の項目の `maxAttempts` / `backoff` を変える `<名前>.override.ts` | 2 override(`overrideOf` の 2 つの鍵だけ) |
| 監視のしきい値 `src/config/domains/outbox.config.ts` | 4 counterpart(設定値) |
| 機能の開閉(送り箱を挙げる機能の切り替え) | 4 counterpart(`src/config/featureGate/switches.config.ts` の値) |
| 表・公開の関数・定期処理のフォルダ・再処理の命令・増設点の宣言 | 上流だけ(フォークは書かない。使うのは公開の関数と項目) |

フォークは表の列を足さない(core/db.md upstream_tables)。足りない物は /order next-starter。
