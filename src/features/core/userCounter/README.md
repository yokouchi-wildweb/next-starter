# userCounter（汎用 per-user カウンタ）

イベント発生ごとに per-user で原子加算する汎用プリミティブ。ゲーミフィケーション・進捗・利用回数表示・コレクション解放などに横断的に使う。**このカウンタが count の source of truth**。

## データモデル

table: `user_counters`
- 単位: `(user_id, counter_key)` → `{ count, first_occurred_at, last_occurred_at }`
- `counter_key`: 名前空間付き文字列。採番は**消費側ドメインの責務**（例: `secret_shop.dialog.<id>`, `secret_shop.talk`）
- `first/last_occurred_at`: 初回/直近の発生時刻（既読・recency 判定が無料で取れる）
- 複合ユニーク `(user_id, counter_key)` = bump の ON CONFLICT ターゲット + prefix 走査索引

## サービス API（サーバ内部用）

import: `import { counterService } from "@/features/userCounter/services/server/counterService"`

- `bump(userId, key, by=1, tx?) → Promise<number>` … 原子加算（無ければ作成）。加算後の最新カウントを返す
- `getCounter(userId, key) → Promise<UserCounter | null>` … null はカウント 0 とみなす
- `getCounters(userId, keys[]) → Promise<Map<key, UserCounter>>` … 欠落キーは Map に含まれない（= 0）
- `getCountersByPrefix(userId, prefix, { limit=100, offset=0 }?) → Promise<UserCounter[]>` … 前方一致一覧
- `...base`（CRUD）も温存。`get(id)` 等は serviceRegistry の汎用 admin ルート用

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

## マイグレーション

`schemaRegistry` に登録済み。テーブル作成は `pnpm db:push` を**手動で**実行すること。
