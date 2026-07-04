# userCounter（汎用 per-user カウンタ）

イベント発生ごとに per-user で原子加算する汎用プリミティブ。ゲーミフィケーション・進捗・利用回数表示・コレクション解放などに横断的に使う。**このカウンタが count の source of truth**。

## カウント要求の決定ガイド（どのプリミティブを使うか）

カウント系の要求は「数える単位 × 時間軸」の行列で必ずどこかに落ちる:

| 数える単位 | 累計 | 日別 |
|---|---|---|
| **ユーザー × キー** | `user_counters`（本ドメイン, bump） | `user_daily_counters`（本ドメイン, bumpDaily） |
| **コンテンツ × アクション** | `interaction_counters`（interactionTracking） | `interaction_daily_counters`（interactionTracking） |

- 「**この人が**何回」→ 本ドメイン。ログイン前提・サーバ内部からのみ加算
- 「**このコンテンツが**（匿名含む全員から）何回」→ interactionTracking。公開 ingest あり
- どちらも人間の操作速度で増えるイベント向け。機械生成の高頻度イベント（テレメトリ等）は守備範囲外（interactionTracking README 参照）

## データモデル

table: `user_counters`（累計・permanent）
- 単位: `(user_id, counter_key)` → `{ count, first_occurred_at, last_occurred_at }`
- `counter_key`: 名前空間付き文字列。採番は**消費側ドメインの責務**（例: `secret_shop.dialog.<id>`, `secret_shop.talk`）
- `first/last_occurred_at`: 初回/直近の発生時刻（既読・recency 判定が無料で取れる）
- 複合ユニーク `(user_id, counter_key)` = bump の ON CONFLICT ターゲット + prefix 走査索引

table: `user_daily_counters`（日次・retention 付き）
- 単位: `(user_id, counter_key, date)` → `{ count, retention_days }`
- 日界は `USER_COUNTER_CONFIG.dailyTimeZone`（既定 Asia/Tokyo, `src/config/app/user-counter.config.ts`）
- bumpDaily が累計と**同一トランザクション**で加算する（バッチ集計なし・集計漏れが構造的に無い）
- ユーザー数 × 日数に比例して増えるため、行単位 `retention_days`（既定 730 日）で cron prune する。
  累計側は prune 対象外なので合計値は失われない
- シャーディング無し: 各ユーザーは自分の行しか書かないため、コンテンツ軸のようなホット行競合は発生しない

## サービス API（サーバ内部用）

import: `import { counterService } from "@/features/userCounter/services/server/counterService"`

- `bump(userId, key, by=1, tx?) → Promise<number>` … 累計のみ原子加算（無ければ作成）。加算後の最新カウントを返す
- `bumpDaily(userId, key, { by=1, retentionDays?, tx? }?) → Promise<{ count, dailyCount }>` … 累計 + 当日を同一 tx で原子加算。日別推移・日次制限が必要なカウンタはこちら
- `getCounter(userId, key) → Promise<UserCounter | null>` … null はカウント 0 とみなす
- `getCounters(userId, keys[]) → Promise<Map<key, UserCounter>>` … 欠落キーは Map に含まれない（= 0）
- `getCountersByPrefix(userId, prefix, { limit=100, offset=0 }?) → Promise<UserCounter[]>` … 前方一致一覧
- `getTodayCount(userId, key) → Promise<number>` … 当日（dailyTimeZone 基準）のカウント。日次制限判定用
- `getDailySeries(userId, key, { from?, to? }?) → Promise<{ date, count }[]>` … 日別推移。0 の日は行が無い（歯抜け）
- `...base`（CRUD）も温存。`get(id)` 等は serviceRegistry の汎用 admin ルート用

### レシピ: 日次制限（1日N回まで）

```ts
// 例: NPC との会話は 1 日 5 回まで
const today = await counterService.getTodayCount(userId, `npc.talk.${npcId}`);
if (today >= 5) throw new DomainError("本日の回数上限に達しました。", { status: 429 });
await counterService.bumpDaily(userId, `npc.talk.${npcId}`);
```

厳密な同時リクエスト耐性が必要な場合（上限すり抜けが許されない課金系等）は、
`bumpDaily` の返す `dailyCount` を加算後に検査して超過なら tx ごとロールバックする形にする。

## セキュリティ（重要）

- `bump` は**サーバ内部専用。クライアントへ直接公開しない**（カウント水増し防止）。発生イベントの正当性は呼び出し側でサーバ検証してから bump すること
- 汎用 API（`/api/userCounter/**`）は **ADMIN_ONLY**（運用閲覧・手動補正のみ、fail-closed）
- ユーザ向けの read エンドポイントは tier1 では提供しない。各ドメインが下記レシピで薄く生やす

## レシピ: ユーザ向け read エンドポイントを生やす

生のカウンタ行はそのまま UI の形ではない（カタログ突合せ・未読 ??? 表示・並び替えが要る）。
各ドメインが `/api/me/<feature>` を `createMeRoute` で薄く作り、**サーバ側で**カウンタを読んでドメイン形に整形して返す。これでキー採番規約をサーバ内に閉じ込められる。

```ts
// src/app/api/me/secret-shop/dialogs/route.ts
import { createMeRoute } from "@/lib/routeFactory";
import { counterService } from "@/features/userCounter/services/server/counterService";
import { SECRET_SHOP_DIALOGS } from "@/features/secretShop/constants"; // tier2 のカタログ

// GET /api/me/secret-shop/dialogs — 自分の既読セリフ一覧（未読は ??? 表示）
export const GET = createMeRoute(
  { operation: "GET /api/me/secret-shop/dialogs", operationType: "read" },
  async (_req, { user }) => {
    // 採番規約（prefix）はこのサーバ側だけが知る
    const counters = await counterService.getCountersByPrefix(
      user.userId,
      "secret_shop.dialog.",
      { limit: 200 },
    );
    const readKeys = new Set(counters.map((c) => c.counter_key));

    // カタログ（全セリフ定義）と突合せ、未読はマスクして返す
    return {
      dialogs: SECRET_SHOP_DIALOGS.map((d) => {
        const key = `secret_shop.dialog.${d.id}`;
        const read = readKeys.has(key);
        return { id: d.id, read, text: read ? d.text : "???" };
      }),
    };
  },
);
```

## レシピ: イベント発生時に bump する

```ts
// tier2 のサーバサービス内（例: 店主に話しかけた / セリフを表示した）
import { counterService } from "@/features/userCounter/services/server/counterService";

// サーバ側で正当性を検証した後に加算
await counterService.bump(userId, "secret_shop.talk");
const shown = await counterService.bump(userId, `secret_shop.dialog.${dialogId}`);

// 同一トランザクションで他の更新とロールバック整合させたい場合は tx を渡す
await db.transaction(async (tx) => {
  await counterService.bump(userId, "secret_shop.talk", 1, tx);
  // ... 他の書き込み ...
});
```

## 他基盤との関係

- `milestone`: `milestone.evaluate()` が本カウンタを読んで達成判定（達成記録は milestone 側）
- `userSegment`: 新ハンドラ経由で本カウンタを参照（ハンドラ実装は消費側）
- `userMetrics`（再集計モデル）とは別物。取り込み要否は消費側の判断

## 進捗バー付きトロフィー（M/N）

本カウンタが source of truth なので、進捗は**読み取り時に導出**できる（`current = counter.count`, `target = 定義値`）。milestone のスキーマ変更は不要。カウンタに紐づかない milestone にも進捗を永続化したくなった時点で、milestone 側に列追加を検討する。

## cron（日次カウンタの prune）

- CLI: `pnpm cron user-daily-counter-prune`
- HTTP: `GET /api/cron/user-daily-counter-prune`（Bearer `CRON_SECRET`）
- 推奨スケジュール: `45 3 * * *`（1 日 1 回・深夜帯）
- 削除対象は**日次行のみ**。累計（user_counters）は消えない

## マイグレーション

`schemaRegistry` に登録済み。テーブル作成は `pnpm db:push` を**手動で**実行すること。
