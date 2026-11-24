# 2026-11-24 送り箱(outbox)を仮に開いた写しの通し

> owner: next-starter

注文 15(AMENDMENT 1 = D54)の記録。区切り outbox の合流地点の先端を使い捨ての写しにし、機能 outbox を写しの中だけで開いて、開発の DB で 積む → 押す → 定期処理 → 再送 → 隔離 → 再処理 を通した。env の値・接続文字列はこの記録に書かない。

## 前提

- 写し: scratch の使い捨ての `git clone --no-local`、`271ea9d59`(合流地点の先端、区切り outbox の notice の commit)。push 先は無効の値。終わりに写しは消した
- env: 本物の `.env.development` から `DATABASE_URL=` の行だけを写しの同じ名前のファイルへ(画面に出さずにファイルへ直に)。写しの読み手が段階の印を求めたので `APP_ENV=development` の 1 行を足した
- 依存: `pnpm install --offline --frozen-lockfile` が通った
- DB: 開発の DB(D54 = 案 A)。本番の DB・Vercel・本物のフォークには触れていない
- 本物の checkout(main・この worktree)の作業ツリーは通しの前後で変わらない

## d1: 閉じた時(規則の既定のまま)

- `pnpm db:push:check` → 「FeatureGate によるスキップ: 40 テーブル」「差分なし」。`outbox_jobs` の文は出ない
- `pnpm generate cron` → 「機能が閉じているタスク」に `outbox-dispatch（outbox）`。`vercel.json` の差分なし(`outbox` を含む行 0)

## 開く(写しの中だけ)

- `pnpm ops features set outbox on` → Tier1 の木では規則のファイル `src/featureGate/rules/outbox.ts` の `defaultEnabled` を書き換えた(`switches.config.ts` は空のまま。Tier1 は規則の既定が持ち主の値)
- 試しの処理の項目 4 つを写しの `src/domains/core/outbox/plugs/outboxHandlers/` に置いた(kind `outbox.runthroughOk` / `Fail` / `Slow` / `Unconfigured`、どれも `maxAttempts: 3`・`backoff: { baseSeconds: 2, maxSeconds: 8 }`。届けた時に scratch のファイルへ 1 行書く。Fail は印のファイルがあれば通る、Slow は 8 秒待つ、Unconfigured は `BackendNotConfiguredError` を投げる)
- `pnpm generate extensions` → 一覧 `extensions/outboxHandlers.ts` に 4 項目。`pnpm generate cron` → `vercel.json` に `/api/cron/outbox-dispatch` の 1 本が載った
- 押す(after())を本物で通すため、写しだけの住所 `POST /api/outbox-runthrough`(`createApiRoute`、public、`withOutbox` で 1 行積む)と `GET`(`outboxStats()`)を置き、写しで開発サーバーを立てた(`pnpm workflow devcheck run server`、終わりに `cleanup` で止めた)。定期処理は開発の段の認証の素通りで `GET /api/cron/outbox-dispatch` を手で叩いた

## push

- push の前の `pnpm db:push:check`(読むだけ)→ 「スキップ: 39 テーブル」「差分あり: 4 文」= `CREATE TABLE "outbox_jobs"` と `CREATE UNIQUE INDEX "outbox_jobs_kind_key_unique"`・`CREATE INDEX "outbox_jobs_status_next_idx"`・`CREATE INDEX "outbox_jobs_kind_status_idx"` だけ。ほかの表の文は無い
- 許可: ボスの言葉「データベースはプッシュしてくれて構わん」(議長のタブ、2026-11-24、Architect がこのタブへ引いて渡した)で `pnpm workflow devcheck allow dbp` → `pnpm workflow devcheck danger dbp` が出した `pnpm db:push` を 1 回
- 結果の 1 行: db_push 成功(4 文を実行、「完了しました」、exit 0)→ `pnpm db:push:check` = 「差分なし」(0 文)

## d2: 積む → 押す

- `POST /api/outbox-runthrough`(kind `outbox.runthroughOk`、鍵 `d2-1`)→ `{ id, duplicate: false }`。応答の後に after() が 1 回処理し、届けた印のファイルに 1 行(`attempt=1`)。行は `done`、attempts 0
- 同じ鍵で 2 回目 → `{ 同じ id, duplicate: true }`、届けた印は 1 行のまま(重複を積まず、押さない)

## d3: 失敗 → 再試行 → 隔離 → 再処理、2 本同時

- `outbox.runthroughFail` を積む → 押しの 1 回目が失敗: `pending`・attempts 1・次の時刻 = 更新の 2 秒後(baseSeconds 2 × 2^0)・`last_error` = `Error: runthrough provider down`
- 定期処理を手で 1 回 → `{ failed: 1 }`、attempts 2・次の時刻 = 4 秒後(2 × 2^1)
- もう 1 回 → `{ quarantined: 1, alerts: 1 }`、`quarantined`・attempts 3(maxAttempts 3)。行は消えない。監視のしきい値(既定 quarantined 1)を超えたので、失敗の記録に `OutboxThresholdExceededError: outbox: kind outbox.runthroughFail がしきい値を超えた(quarantined=1≥1)` が 1 行出た(開発サーバーの記録)。隔離のままの次の回も `alerts: 1`(超えている間は毎回 1 行)
- 印のファイルを置いて処理を直し、`pnpm task outbox:reprocess -- --kind outbox.runthroughFail` → `succeeded`、`reprocessed: 1`。行は `pending`・attempts 0・次の時刻 = 今
- 定期処理 1 回 → `{ done: 1 }`、届けた印 1 行。もう一度 `outbox:reprocess` → `reprocessed: 0`(隔離でない行は触らない)
- 2 本同時: 待ちの `outbox.runthroughSlow`(8 秒)の行を 1 つ置き、定期処理を 1.5 秒ずらして 2 本 → 後の 1 本が `{ locked: true }`(何もしない)、先の 1 本が `{ locked: false, done: 1 }`。届けた印はその行で 1 行

## d4: 未設定の基底 → 保留、監視

- `outbox.runthroughUnconfigured` を積む → 押しで `BackendNotConfiguredError`: `pending`・attempts 0・次の時刻 = 2 秒後・`last_error` = `BackendNotConfiguredError: runthrough port not configured`
- 定期処理を 3 回 → 毎回 `{ held: 1 }`、attempts は 0 のまま、次の時刻だけ毎回 2 秒先へ(試行を数えないので間隔は 1 回目の値のまま)、隔離しない
- `outboxStats()`(`GET /api/outbox-runthrough`)→ `[{ kind: "outbox.runthroughUnconfigured", pending: 1, oldestWaitSeconds: 26, quarantined: 0, handler: "open" }]`(届けた行は数えない)。隔離の数は d3 のしきい値の記録で確かめた

## d5: 後片付け

- 試しの kind(`outbox.runthrough%`)の行だけを消した: 5 行 → 残り 0 行。表 `outbox_jobs` とその索引は開発の DB に残した(D54: 後で使う口が開けばそのまま使う、要らなければ人が消す)。main の規則は閉じたままなので、main の `pnpm db:push` はこの表を消さず残す(閉じた表は push の対象の外)
- 開発サーバーを止め(`pnpm workflow devcheck cleanup`)、写しと scratch の印・記録のファイルを消した

## FINDINGS(この注文では直さない)

- F1: 未設定の基底の保留は試行を数えないので、次の時刻はいつも 1 回目の間隔(既定 30 秒)の後になる。Pro の毎分の定期処理では、env が入るまで毎分 1 回その処理を呼ぶ(隔離しない設計 D23 のとおり)。保留にも間隔を伸ばす数え方を持たせるかは後の設計の点
- F2: しきい値を超えている間は定期処理のたびに 1 行記録する(J17 の報告と同じ)。間引きの窓が要るかは後の設計の点
- F3: 通しの途中、写しの env ファイルを shell の `set -a; . file` で読ませた時、接続文字列の `&` で行が切れ、shell の job の表示にその行がこのセッションの出力へ出た(記録・外部には出していない)。以後は node の `--env-file` で読ませた。env ファイルを shell で読ませない(値に `&` がある)
