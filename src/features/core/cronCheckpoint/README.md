# cronCheckpoint（cron のウォータマーク永続化）

差分 cron や再開可能バッチが「ここまで処理済み」を覚えておくための単調チェックポイント。
1 テーブル + 数関数の最小プリミティブ。HTTP ルートは持たない（server-internal only）。

## 何を解決するか

- 「毎回全件を舐める O(N) cron」は成長とともに serverless の maxDuration で途中 kill され、
  read-model が恒久的に古くなる（下流で実際に発生した障害）。
- 差分化には「前回どこまで処理したか」の永続化が要る。各 cron が独自に持つと
  単調性（後退しない）・並走安全・巻き戻し手順がバラつくので、ここに集約する。
- 時間予算ランナー（`@/lib/cron` の `runBudgetedBatches`）と組み合わせると、
  チャンクごとに前進 → 途中 kill でも次回は続きから、が成立する。
  組み合わせ済みの完成品が `@/features/incrementalRefresh`。

## データモデル

table: `cron_checkpoints`
- `name text PK` … タスク固有の名前空間付き文字列（例: `user-metrics-refresh`）
- `checkpoint_at timestamptz` … この時刻までの入力は処理済み
- `updated_at timestamptz`

## サービス API

import: `import { getCheckpoint, advanceCheckpoint } from "@/features/cronCheckpoint/services/server"`

- `getCheckpoint(name, fallback, tx?) → Date`
  未登録なら `fallback` を返す（書かない）。
  初回に全件を対象にしたいなら `new Date(0)`、導入前の履歴を捨ててよいなら `new Date()`。
- `advanceCheckpoint(name, ts, tx?) → { checkpointAt, advanced }`
  単調前進。`INSERT ... ON CONFLICT DO UPDATE SET checkpoint_at = GREATEST(現在値, 新値)` の 1 文なので
  並走 cron や古い値の再送でも後退しない。`advanced=false` は「既に先へ進んでいた」。
- `resetCheckpoint(name, ts, tx?)` … 無条件上書き（後退可）。**運用操作専用**（遡及修正後に巻き戻して再処理させる等）。cron 経路から呼ばない。
- `deleteCheckpoint(name, tx?) → boolean` … 行削除。次回 `getCheckpoint` は fallback に戻る。
- `findCheckpoint(name)` / `listCheckpoints()` … 運用確認用の生読み。

## 使い方（生プリミティブとして）

```ts
import { createDeadline, runBudgetedBatches } from "@/lib/cron";
import { advanceCheckpoint, getCheckpoint } from "@/features/cronCheckpoint/services/server";

const NAME = "my-sweep";
const startedAt = new Date();
const since = await getCheckpoint(NAME, new Date(0));

const result = await runBudgetedBatches({
  deadline: createDeadline(240_000, startedAt),
  fetchNext: async (cursor) => {
    const rows = await fetchRowsUpdatedAfter(since, cursor, 200); // 呼び出し側の SQL
    if (rows.length === 0) return null;
    return { items: rows, cursor: rows.at(-1)!.updatedAt, done: rows.length < 200 };
  },
  processChunk: async (rows) => process(rows),
  // チャンク完了ごとに前進。実行開始後の更新は走査に含まれた保証が無いので startedAt を上限にする
  onChunkDone: async ({ cursor }) => advanceCheckpoint(NAME, cursor < startedAt ? cursor : startedAt),
});
if (result.exhausted) await advanceCheckpoint(NAME, startedAt);
```

ウォータマーク走査を自前で書くより、`@/features/incrementalRefresh` の `createIncrementalRefresh` を
使う方が短い（重なり幅・keyset ページング・trickle 安全網が同梱）。

## 運用

- 巻き戻し: `resetCheckpoint("<name>", new Date("2026-08-01T00:00:00Z"))` を `pnpm task` のワンショットタスクか
  スクリプトから呼ぶ。次回 cron がその時刻以降を再処理する（recompute が冪等であること）。
- 確認: `pnpm db:query "SELECT * FROM cron_checkpoints ORDER BY name"`
- DB 反映: `cron_checkpoints` テーブルは schemaRegistry 登録済み。導入時に `pnpm db:push`。
