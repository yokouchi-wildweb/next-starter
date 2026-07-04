# interactionTracking ドメイン

匿名ユーザーを含む行動イベント（クリック等）を (target_type, target_id, action) 単位で記録・集計する汎用計測基盤。

## このドメインの責務（何のためにあるか）

「**匿名を含む不特定多数が、コンテンツ単位で何回アクションしたか**」を答えるためのドメイン。

- 管理画面での **累計表示**（例: バナーAのクリック合計）
- **マーケティング用の長期時系列分析**（例: 月別クリック推移・導線別内訳。日次集計は永久保持）
- 将来: 「target X をクリックしたユーザー」抽出（userSegment 連携。明細に user_id を保持）

### 使ってよい用途 / 使ってはいけない用途

判定基準: **「ユーザーの指がクリックする速度でしか増えないイベントか？」**

| ✅ 守備範囲 | ❌ 守備範囲外 |
|---|---|
| バナー / CTA / リンクのクリック | 全ページのインプレッション自動送信 |
| キャンペーン LP・共有リンクの開封 | リアルタイムゲームの操作ログ・スコア更新 |
| コンテンツの利用・再生開始などの能動アクション | スクロール・マウス移動などの機械的高頻度イベント |

守備範囲外の「機械的に大量発生するイベント」は、クリック1回=DB書き込み1トランザクションという本ドメインの構造に合わない（恒常的に毎秒数千件を超えると Postgres 直挿しが本体 DB の帯域を圧迫する）。その物量が必要になったら、キュー + 一括書き込みや外部分析基盤を**別の仕組みとして**用意すること。本ドメインを改造して対応しようとしないこと。

### 隣接プリミティブとの棲み分け

- **auditLog**: 「誰が何をどう変更したか」の証跡（コンプラ用）。行動計測への転用禁止
- **userCounter**: 「この**ユーザー**が何回したか」（per-user・ログイン前提・サーバー内部専用）。
  日次テーブルも持つ。**カウント要求の決定ガイド（4マスの行列）は userCounter README 参照**
- **analytics**: 既存テーブルの読み取り専用集計。イベントの記録はしない
- **interactionTracking（本ドメイン）**: 匿名込み・**コンテンツ単位**の行動カウント

## データ設計（3 テーブル・寿命の分離）

| テーブル | 役割 | 寿命 |
|---|---|---|
| `interaction_events` | イベント明細（追記専用）。「いつ・誰が・どこから」。調査・検算・将来のセグメント抽出用 | 行単位 `retention_days`（既定 365 日）で cron prune |
| `interaction_counters` | 累計カウンタ。管理一覧の合計表示用 | 永久 |
| `interaction_daily_counters` | **日次集計（日 × 対象 × アクション × 導線）。マーケティング時系列の真** | **永久** |

- 集計 2 テーブルの行数はユーザー数・クリック数に比例しない（対象数 × 語彙 × 日数でのみ増える）ため永久保持が成立する。**保持期限で失われるのは明細の粒度だけ**で、合計値と日別内訳は永久に残る
- 集計はバッチではなく `record()` の**同一トランザクション内でその場で加算**される（3書き込み）。集計漏れが構造的に起きず、明細がいつ prune されても集計は完成している
- 日次集計の日界は `aggregationTimeZone`（既定 Asia/Tokyo、`src/config/app/interaction-tracking.config.ts`）

### ホットカウンタ対策（シャーディング）

カウンタ行は shard 列（既定 8）でランダム分散し、人気ターゲットへの同時クリックでも行ロック競合が 1/N になる。読み取りは常に `SUM` するため shard 数は値に影響しない。in-memory バッファは不採用（サーバーレス / 複数インスタンスで欠損・多重加算の温床になるため）。

## 書き込み経路

1. **公開 ingest（主経路）**: `POST /api/interactions`
   - `access: "public"`（匿名可）+ IP / サブネットのハイブリッドレート制限
   - `interactionTargetRegistry` 未登録の targetType は **fail-closed で拒否**
   - ログイン中はセッションから userId を自動付与（クライアント申告は受け付けない）
   - デモユーザーの書き込みは自動スキップ（カウントに混入しない）
2. **サーバー内部**: `interactionService.record({...})` — サーバーロジックから直接記録する場合
   （`tx` を渡せば呼び出し側トランザクションに合流）

汎用 API (`/api/interactionEvent`) は admin 限定のイベント明細調査・閲覧用。
**汎用 CRUD での直接挿入はカウンタを加算しない**ため、通常運用では使わないこと。

## 下流での配線レシピ（例: bulletin バナーのクリック計測）

### 1. 計測対象を登録（サーバー・fail-closed の解除）

`src/registry/interactionTargetRegistry.ts`:

```ts
import { bulletinService } from "@/features/bulletin/services/server/bulletinService";

export const interactionTargetRegistry: Record<string, InteractionTargetRule> = {
  bulletin: {
    allowedActions: ["click", "link_click"],
    validate: async (targetId) => {
      const bulletin = await bulletinService.get(targetId).catch(() => null);
      return !!bulletin?.is_published; // 公開中のみ受け付ける（水増し防止）
    },
    // retentionDays: 730,   // 明細を長めに持ちたい対象はここで上書き
    // recordDetail: false,  // 「誰が」が不要で流量の多い対象は明細オフ（集計のみ）
  },
};
```

### 2. クライアントから記録（fire-and-forget）

```tsx
import { trackInteraction } from "@/features/interactionTracking/services/client/interactionClient";

// クリックハンドラ内。await しない・UI をブロックしない
trackInteraction({ targetType: "bulletin", targetId: bulletin.id, action: "click", source: "home" });
```

action / source の語彙の採番は消費側ドメインの責務（userCounter の counter_key と同じ方針）。

### 3. 管理一覧にカウントを表示（サーバー側で一括取得）

```ts
import { interactionService } from "@/features/interactionTracking/services/server";

const counts = await interactionService.getCountsBulk("bulletin", bulletins.map((b) => b.id));
const clickCount = counts.get(bulletin.id)?.get("click") ?? 0;
```

### 4. 時系列分析（マーケティング用・永久データ）

```ts
const series = await interactionService.getDailySeries("bulletin", bulletin.id, {
  from: "2026-01-01",
  to: "2026-06-30",
  action: "click", // 省略で全 action
});
// => [{ date: "2026-01-01", action: "click", source: "home", count: 12 }, ...]
// 導線を問わない日別合計が欲しい場合は date × action で畳み込む
```

### 5. cron の配線

- CLI: `pnpm cron interaction-event-prune`
- HTTP: `GET /api/cron/interaction-event-prune`（Bearer `CRON_SECRET`）
- 推奨スケジュール: `30 3 * * *`（1 日 1 回・深夜帯）
- 削除対象は**明細のみ**。累計・日次集計は消えない

### 6. DB 反映

テーブルは schemaRegistry 登録済み。`pnpm db:push` は手動実行の運用（自動実行しない）。

## サーバー API

| メソッド | 概要 |
|---|---|
| `record(input)` | 明細追記 + 累計/日次の原子加算（同一 tx・3書き込み）。サーバー内部専用 |
| `getCounts(targetType, targetId)` | 累計: `Map<action, count>` |
| `getCountsBulk(targetType, targetIds[])` | 累計: `Map<targetId, Map<action, count>>`（1 クエリ） |
| `getDailySeries(targetType, targetId, opts?)` | 日次時系列: `{date, action, source, count}[]`（永久データ） |
| `pruneExpiredInteractionEvents(options?)` | 明細の retention prune（cron 用） |
| `...base` | 汎用 CRUD（admin 調査用） |

## 将来スコープ（設計上の考慮のみ・未実装）

- **インプレッション計測**: クライアント側バッチ送信（CTR 算出）。1 件ずつの送信は守備範囲外の物量になるため、バッチ ingest の設計とセットで導入すること。`metadata` jsonb 列は確保済み
- **userSegment 連携**: 「target X をクリックしたユーザー」条件ハンドラ。`interaction_events` の (user_id, created_at) インデックスは確保済み
- **管理 UI パーツ**: `<InteractionCount targetType targetId />`、時系列チャート
