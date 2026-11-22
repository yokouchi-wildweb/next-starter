# interactionTracking

## Overview

- 匿名ユーザーを含む行動イベント（クリック等）を (target_type, target_id, action) 単位で記録・集計する汎用計測基盤
- 答える問い: 「匿名を含む不特定多数が、コンテンツ単位で何回アクションしたか」。管理画面での累計表示（例: バナーAのクリック合計）と、マーケティング用の長期時系列分析（例: 月別クリック推移・導線別内訳。日次集計は永久保持）
- 閉じられる機能(門番の規則 `src/featureGate/rules/interactionTracking.ts`、既定は閉 `defaultEnabled: false`。開くのは `pnpm ops features set interactionTracking on`)。閉じると `/api/interactions`・`/api/admin/interactions`・`domains` から導く汎用 API `/api/interactionEvent`・掃除の cron が 404 で、表も push から外れる
- 使う時・直す時の決まりは札 .claude/rules/items/domains/interactionTracking.md にある

### 守備範囲

判定基準: **「ユーザーの指がクリックする速度でしか増えないイベントか？」**

| ✅ 守備範囲（1件ずつの ingest） | ✅ 守備範囲（バッチ ingest） | ❌ 守備範囲外 |
|---|---|---|
| バナー / CTA / リンクのクリック | バナー等のインプレッション（表示回数） | リアルタイムゲームの操作ログ・スコア更新 |
| キャンペーン LP・共有リンクの開封 | 「見ただけ」系の高頻度イベント全般 | スクロール・マウス移動などの連続イベント |
| コンテンツの利用・再生開始などの能動アクション | | 日数千万件を超える恒常的な物量 |

- **1件ずつの ingest**（`/api/interactions`）: 人間の操作速度で増えるイベント。明細（誰が・いつ）も記録できる
- **バッチ ingest**（`/api/interactions/batch`）: インプレッション等の機械発生イベント。クライアント側で集約して送り、サーバーは**集計のみ**加算（明細なし・「誰が」は残らない）
- それでも溢れる物量（日数千万件〜）は、キュー + 一括書き込みや外部分析基盤など別の仕組みの物（CLAUDE.md COUNTING NOT_for）

### 隣接プリミティブとの棲み分け

- **auditLog**: 「誰が何をどう変更したか」の証跡（コンプラ用）。行動計測には使わない（CLAUDE.md COUNTING NOT_for）
- **userCounter**: 「この**ユーザー**が何回したか」（per-user・ログイン前提・サーバー内部専用）。
  日次テーブルも持つ。**カウント要求の決定ガイド（単位×時間軸の行列。DAU/訪問日数系は core/analytics の DAU 基盤）は userCounter README 参照**
- **analytics**: 既存テーブルの読み取り専用集計。イベントの記録はしない
- **interactionTracking（本ドメイン）**: 匿名込み・**コンテンツ単位**の行動カウント

## Usage

- 例は bulletin バナーのクリック計測

### 1. 計測対象を登録（サーバー・fail-closed の解除）

`<ドメイン>/plugs/interactionTrackingTargetRules/bulletin.ts` に置き `pnpm generate extensions`:

```ts
import { bulletinService } from "@/domains/bulletin/services/server/bulletinService";
import type { InteractionTargetRule } from "@/domains/core/interactionTracking/types/targetRule";

export const rule: InteractionTargetRule = {
  targetType: "bulletin",
  allowedActions: ["click", "link_click"],
  batchActions: ["impression"], // バッチ経路で受けるのはインプレッションのみ（click は不可）
  validate: async (targetId) => {
    const bulletin = await bulletinService.get(targetId).catch(() => null);
    return !!bulletin?.is_published; // 公開中のみ受け付ける（水増し防止）
  },
  // retentionDays: 730,   // 明細を長めに持ちたい対象はここで上書き
  // recordDetail: false,  // 「誰が」が不要で流量の多い対象は明細オフ（集計のみ）
};
```

### 2. クライアントから記録（fire-and-forget）

```tsx
import { trackInteraction } from "@/domains/interactionTracking/services/client/interactionClient";

// クリックハンドラ内。await しない・UI をブロックしない
trackInteraction({ targetType: "bulletin", targetId: bulletin.id, action: "click", source: "home" });
```

- action / source の語彙は消費側ドメインが付ける（userCounter の counter_key と同じ）

### 3. インプレッション計測（表示されたら記録・CTR 用）

```tsx
import { useImpressionTracker } from "@/domains/interactionTracking/hooks/useImpressionTracker";

const impressionRef = useImpressionTracker({
  targetType: "bulletin",
  targetId: bulletin.id,
  source: "home",
});
return <Block ref={impressionRef}>{/* バナー */}</Block>;
```

- 要素の 50% がビューポートに入った時点で 1 回計上（マウント毎に 1 回・重複なし）。表示の監視は `@/hooks/useInView` に任せ、記録した後は監視を外す。対象（targetId 等）が変わったら新しい対象として、もう一度見えたときに計上する
- 送信はバッファ集約（15 秒ごと / ページ離脱時 / 満杯時にまとめて 1 リクエスト）。
  離脱時は sendBeacon で取りこぼしを防ぐ
- CTR はクリックと同じ軸に載る: `getDailySeries` で click ÷ impression を日別に計算できる
- ビューポート判定が不要な場合は `trackImpression()` を直接呼んでもよい

### 4. 管理一覧にカウントを表示（サーバー側で一括取得）

```ts
import { interactionService } from "@/domains/interactionTracking/services/server";

const counts = await interactionService.getCountsBulk("bulletin", bulletins.map((b) => b.id));
const clickCount = counts.get(bulletin.id)?.get("click") ?? 0;
```

### 5. 時系列分析（マーケティング用・永久データ）

```ts
const series = await interactionService.getDailySeries("bulletin", bulletin.id, {
  from: "2026-01-01",
  to: "2026-06-30",
  action: "click", // 省略で全 action
});
// => [{ date: "2026-01-01", action: "click", source: "home", count: 12 }, ...]
// 導線を問わない日別合計が欲しい場合は date × action で畳み込む
```

### 6. オーディエンスビューア（誰がクリックしたか・admin 画面用）

- UI は本ドメインに無い（データレイヤまで）。以下のデータ契約の上に、各 fork が自前の UI を組む:

- API: `GET /api/admin/interactions/audience?targetType&targetId&action&page&limit&orderBy`
  （admin 限定・PII 含む）→ `{ total, results: [{ userId, name, email, clickCount, lastClickedAt }] }`
  - `orderBy`: `lastClickedAt`（新しい順・既定）| `clickCount`（回数順）、`limit` 既定 50・上限 100
- API: `GET /api/admin/interactions/audience-summary?targetType&targetId`
  → `{ [action]: { lifetimeTotal, loggedInCount, anonymousCount } }`
- ClientService: `fetchInteractionAudience` / `fetchInteractionAudienceSummary`
  （services/client/interactionAdminClient）
- hooks: `useInteractionAudienceSummary(targetType, targetId, { enabled })`（SWR）。
  一覧側は `useInfiniteScrollQuery`（src/hooks）に `fetchInteractionAudience` を渡せば
  無限スクロールがそのまま成立する

```tsx
// downstream での実装例（UI の形は完全に自由）
const fetcher = useCallback(
  ({ page, limit }) => fetchInteractionAudience({ targetType, targetId, action, orderBy, page, limit }),
  [targetType, targetId, action, orderBy],
);
const { items, total, isLoading, hasMore, sentinelRef } = useInfiniteScrollQuery({
  fetcher, limit: 50, deps: [targetType, targetId, action, orderBy],
});
```


表示側の前提:
- 一覧・ログイン/匿名内訳は**明細ベース（保持期限内のみ）**、累計は永久カウンタ。
  prune 後に乖離するのは正常
- 退会済みユーザー（SET NULL）は匿名に合流する
- `recordDetail: false` の対象は明細が無い（「累計 > 0 かつ 内訳 = 0」は内訳非対応）

### 7. cron と DB 反映

- CLI: `pnpm task interaction-event-prune`
- HTTP: `GET /api/cron/interaction-event-prune`（Bearer `CRON_SECRET`）
- スケジュール: 日次（`vercel.json` のエントリは `pnpm generate cron` が生成）
- 削除対象は**明細のみ**。累計・日次集計は消えない
- テーブルは schemaRegistry 登録済み。`pnpm db:push`（誰が回すかは repo.json `agent.db_push`）

## API

### 書き込み経路

1. **公開 ingest（主経路）**: `POST /api/interactions`
   - `access: "public"`（匿名可）+ IP / サブネットのハイブリッドレート制限
   - 一覧 `targetRules` に無い targetType は **fail-closed で拒否**
   - ログイン中はセッションから userId を自動付与（クライアント申告は受け付けない）
   - デモユーザーの書き込みは自動スキップ（カウントに混入しない）
2. **バッチ ingest（インプレッション等）**: `POST /api/interactions/batch`
   - クライアント側で集約済みの (target × action × source) → count を最大100エントリ一括送信
   - **registry の `batchActions` に明示された action のみ受理**（fail-closed）。count をまとめて申告できる経路
   - 明細は書かない（集計のみ・userId も記録しない）。検証に失敗したエントリは棄却して残りを処理
3. **サーバー内部**: `interactionService.record({...})` / `recordBatch([...])` — サーバーロジックから
   直接記録する場合（`tx` を渡せば呼び出し側トランザクションに合流）

- 管理の読み取り: `GET /api/admin/interactions/audience` / `GET /api/admin/interactions/audience-summary`（admin 限定、形は Usage）
- 汎用 API (`/api/interactionEvent`) は admin 限定のイベント明細調査・閲覧用。汎用 CRUD での直接挿入はカウンタを加算しない

### サーバー関数

| メソッド | 概要 |
|---|---|
| `record(input)` | 明細追記 + 累計/日次の原子加算（同一 tx・3書き込み）。サーバー内部専用 |
| `recordBatch(entries, tx?)` | 集約済みイベントの一括加算（集計のみ・明細なし）。サーバー内部専用 |
| `getCounts(targetType, targetId)` | 累計: `Map<action, count>` |
| `getCountsBulk(targetType, targetIds[])` | 累計: `Map<targetId, Map<action, count>>`（1 クエリ） |
| `getDailySeries(targetType, targetId, opts?)` | 日次時系列: `{date, action, source, count}[]`（永久データ） |
| `getAudience(targetType, targetId, {action, page, limit, orderBy})` | 「誰がクリックしたか」ユーザー単位一覧（PII 含む・admin ルート専用） |
| `getAudienceSummary(targetType, targetId)` | action 別の 累計 / ログイン済み / 匿名 件数 |
| `pruneExpiredInteractionEvents(options?)` | 明細の retention prune（cron 用。`interactionService` ではなく `services/server` の export） |
| `...base` | 汎用 CRUD（admin 調査用） |

## Extension

- 点 `interactionTrackingTargetRules`: 公開 ingest(`POST /api/interactions` / `/batch`)の計測対象の規則。差す側の `<ドメイン>/plugs/interactionTrackingTargetRules/<名前>.ts` に `export const rule: InteractionTargetRule` を置き `pnpm generate extensions`(書き方は Usage「1. 計測対象を登録」)。上流の項目は 0。項目の無い targetType・項目のドメインが閉じた targetType は拒否(fail-closed、読み手 `targetRuleOf`)
  - 型 `InteractionTargetRule`(`@/domains/core/interactionTracking/types/targetRule`): `targetType` / `allowedActions` / `batchActions`(バッチ経路で受ける action) / `validate(targetId)` / `retentionDays`(明細の保持日数の上書き) / `recordDetail`(false = 明細を書かず集計だけ)。`targetType` が鍵(重複は生成で例外)
- 設定 `src/config/domains/interactionTracking.config.ts`: `counterShardCount`（カウンタの shard 数）/ `defaultRetentionDays`（明細の保持日数）/ `aggregationTimeZone`（日次集計の日界）(持ち主 `config.ts`)

## Internals

### データ設計（3 テーブル・寿命の分離）

| テーブル | 役割 | 寿命 |
|---|---|---|
| `interaction_events` | イベント明細（追記専用）。「いつ・誰が・どこから」。調査・検算・将来のセグメント抽出用 | 行単位 `retention_days`（既定 365 日）で cron prune |
| `interaction_counters` | 累計カウンタ。管理一覧の合計表示用 | 永久 |
| `interaction_daily_counters` | **日次集計（日 × 対象 × アクション × 導線）。マーケティング時系列の真** | **永久** |

- 集計 2 テーブルの行数はユーザー数・クリック数に比例しない（対象数 × 語彙 × 日数でのみ増える）ため永久保持が成立する。**保持期限で失われるのは明細の粒度だけ**で、合計値と日別内訳は永久に残る
- 集計はバッチではなく `record()` の**同一トランザクション内でその場で加算**される（3書き込み）。集計漏れが構造的に起きず、明細がいつ prune されても集計は完成している
- 日次集計の日界は `aggregationTimeZone`（既定 Asia/Tokyo。持ち主 `config.ts`、上書き `src/config/domains/interactionTracking.config.ts`）

### ホットカウンタ対策（シャーディング）

カウンタ行は shard 列（既定 8）でランダム分散し、人気ターゲットへの同時クリックでも行ロック競合が 1/N になる。読み取りは常に `SUM` するため shard 数は値に影響しない。in-memory バッファは持たない（サーバーレス / 複数インスタンスで欠損・多重加算の温床になるため）。

## Related

- `src/domains/core/userCounter/README.md`: per-user のカウントと、カウント要求の決定ガイド
