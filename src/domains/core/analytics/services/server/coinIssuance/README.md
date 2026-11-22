# analytics/coinIssuance

## Overview

- `GET /api/admin/analytics/coin-issuance/summary` は拡張可能な集計レジストリで、各ドメインが「コイン創出ソース (`CoinIssuanceSource`)」を登録するだけでサービス全体の `finalProfit` 計算に組み込まれる。上流と fork の双方がソースを登録でき、「最終収支」の定義がサービス間でぶれない
- 使う時の決まりは札 .claude/rules/items/domains/analytics.md にある
各ソースは 1 種類のコイン収支寄与を表す。

- `kind: "revenue"` … 収入源 (例: ガチャ売上)。`finalProfit` に加算される
- `kind: "issuance"` … 発行源 = サービスが負担する費用 (例: クーポンボーナス、紹介リワード、当選報告特典)。`finalProfit` から減算される

`finalProfit = Σ revenue.current − Σ issuance.current`

## Usage

### ソースを足す

1. `CoinIssuanceSource` を満たす値を作成する
2. `services/server/coinIssuance/sources/<名前>.ts` に `export const source` を置き `pnpm generate extensions`（閉じられる機能を読むソースは `enabled` が必須）
   - 一覧の順 = ファイル名の順で、応答の `sources` の順もこれ。順序のキーは無い。表示順を決めたい fork は画面側でキーの並びを持って並べる（数値は変わらない）
3. (任意) `src/domains/core/analytics/config.ts` の `coinIssuanceLabels` に表示名を足す

```typescript
// 例: src/domains/gacha/analytics/coinIssuance/gachaProfitSource.ts
import { db } from "@/lib/drizzle";
import { GachaPlayTable } from "@/domains/gacha/entities/drizzle";
import { and, between, sql } from "drizzle-orm";
import { buildUserFilterConditions } from "@/domains/core/analytics/services/server/utils/userFilter";
import type { CoinIssuanceSource } from "@/domains/core/analytics/services/server/coinIssuance";

const t = GachaPlayTable;

export const gachaProfitSource: CoinIssuanceSource = {
  key: "gacha_profit",
  kind: "revenue",

  async aggregate({ range, prevRange, userFilter }) {
    const isCurrent = sql`(${t.createdAt} >= ${range.dateFrom.toISOString()} AND ${t.createdAt} <= ${range.dateTo.toISOString()})`;
    const isPrev = sql`(${t.createdAt} >= ${prevRange.dateFrom.toISOString()} AND ${t.createdAt} <= ${prevRange.dateTo.toISOString()})`;

    // 当期+前期を CASE WHEN で 1 クエリ集計
    const rows = await db
      .select({
        current: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN ${t.profit} ELSE 0 END), 0)`.as("current_profit"),
        previous: sql<number>`COALESCE(SUM(CASE WHEN ${isPrev} THEN ${t.profit} ELSE 0 END), 0)`.as("prev_profit"),
      })
      .from(t)
      .where(and(
        between(t.createdAt, prevRange.dateFrom, range.dateTo),
        ...buildUserFilterConditions(t.user_id, userFilter),
      ));

    return {
      current: Number(rows[0]?.current ?? 0),
      previous: Number(rows[0]?.previous ?? 0),
    };
  },
};
```

```typescript
// src/domains/core/analytics/services/server/coinIssuance/sources/gachaProfit.ts
import { gachaProfitSource } from "@/domains/gacha/analytics/coinIssuance/gachaProfitSource";

export const source = gachaProfitSource;
```

```typescript
// (任意) src/domains/core/analytics/config.ts の coinIssuanceLabels に足す
  gacha_profit: "ガチャ収支",
```

### 書き方のこつ

報酬・特典系の付与額は **ドメインテーブルに専用カラム** として持つことを強く推奨する。

- **推奨**: 付与時に `promotion_reward_coin_amount: integer` 等のカラムへスナップショット書き込み → 集計は `SUM(promotion_reward_coin_amount)` で済む
- **非推奨**: `wallet_history.reason LIKE '当選報告特典%'` のような文字列マッチ集計

専用カラム方式のメリット:
- reason 文字列の変更や handler 追加に強い (`promotion_reward_coin_amount` の意味は固定)
- 集計 SQL が単純化される (LIKE / 正規表現を避けられる)
- 監査ログとの整合が取りやすい

専用カラムが追加できない事情がある場合のみ wallet_history からの集計を選ぶ。

#### 当期+前期を 1 クエリで集計

各ソースは `Promise.all` で並列実行されるため個別ソース内のクエリ数は少ない方が良い。
**当期と前期を別クエリにせず、`CASE WHEN` で 1 クエリにまとめる** (上記テンプレート参照)。
これは既存 summary 系 (`purchaseAnalytics`, `referralAnalytics`) と同じパターン。

#### UserFilter は意味のある場合のみ適用

`userFilter (roles / excludeDemo)` は対象テーブルの `user_id` カラムに対して
`buildUserFilterConditions(column, userFilter)` で適用できる。
ただし「発行先 user を絞り込むことが意味を持たないソース」は適用しない。分析の除外条件は第 3 引数の scope で足す（`../exclusion/README.md` の Usage）。

#### 戻り値は常に絶対値

`CoinIssuanceSource.aggregate()` の戻り値 `{current, previous}` は絶対値 (正の数)。符号反転 (issuance を finalProfit から減算する処理) は aggregator が持つ。

#### key 命名

`CoinIssuanceSource.key` は API レスポンスの `sources` Record のキーとしてそのまま使われる。
upstream の key と衝突しない snake_case を選ぶ。
`gacha_profit`, `winning_report_reward`, `winning_comment_reward` 等、ソースの意味が読み取れる命名にする。

### 紹介報酬の金額抽出 SQL を差し替える（内訳の集計）

`aggregateReferralRewardCurrentVsPrev` は `metadata ->> 'amount'` で金額を抽出する規約に従う。
規約が異なる downstream は `rewardAmountExpr` を渡す。紹介報酬は `wallet_bonus_grant` に含まれるので、
これをコイン創出の `sources` に足すと二重計上になる。内訳の画面（や合計に入れない表示）で使う。

```typescript
import { sql } from "drizzle-orm";
import { ReferralRewardTable } from "@/domains/core/referralReward/entities/drizzle";
import { aggregateReferralRewardCurrentVsPrev } from "@/domains/core/analytics/services/server/referralAnalytics";
import type { CoinIssuanceSource } from "@/domains/core/analytics/services/server/coinIssuance";

// 独自 metadata 構造 ({ rewardCoins: number } 等) を持つ downstream の内訳用(合計の sources には登録しない)
export async function getReferralRewardBreakdown({ range, prevRange }: Parameters<CoinIssuanceSource["aggregate"]>[0]) {
  return aggregateReferralRewardCurrentVsPrev({
    range,
    prevRange,
    rewardAmountExpr: sql<number>`(${ReferralRewardTable.metadata} ->> 'rewardCoins')::numeric`,
  });
}
```

## API

### 上流の組み込みソース

| key | kind | 概要 |
|---|---|---|
| `purchase_bonus_gap` | issuance | `purchase_requests` の `SUM(amount - payment_amount) WHERE status='completed'`（コイン購入時にサービスが負担した分のうち `amount` に含まれるもの＝クーポン割引・購入パッケージの上乗せ等。別のウォレット行で払うボーナスは `wallet_bonus_grant` 側）|
| `wallet_bonus_grant` | issuance | `wallet_histories` の `SUM(balance_after - balance_before)`。対象 = 数える通貨（`coinIssuanceWalletTypes`、既定 `regular_coin`）× 数える区分（`issuanceReasonCategories`、既定 `bonus`）。付与元を問わず 1 本で数える（紹介報酬・クーポン帰属報酬・登録ボーナス・fork の施策も、wallet の行を `bonus` で書けば入る）。flow の scope（`wallet_histories`）で UserFilter と除外 |

**台帳の純額で 1 本に数える（二重計上しない）**:

- 付与元の表ごとのソース（紹介報酬 `referral_rewards`・クーポン帰属報酬 `coupon_attribution_rewards` など）は `wallet_bonus_grant` の部分集合。`sources` に並べると `finalProfit` から二重に引かれるので、上流は登録しない。内訳を見たい画面は `aggregateReferralRewardCurrentVsPrev`（`referralAnalytics.ts`）・`aggregateCouponAttributionRewardCurrentVsPrev`（`couponAttributionAnalytics.ts`）を別に呼ぶ（合計には足さない）
- **数える区分** = `src/domains/core/analytics/config.ts` の `issuanceReasonCategories`（上流の既定は `["bonus"]`。何を創出と数えるかは分析の判断なので区分の表と分けて持つ）。fork のカテゴリも上書き `src/config/domains/analytics.config.ts` の一覧に足す
  - `other` は既定で数えない: 区分を書かずに書いた行（`DEFAULT_REASON_CATEGORY`）と reason_category の導入前の行（全部 `other` で埋まっている）が入り、ガチャ・調整・退会の残高クリアなどの引き落としで純額が負になり得るため
  - 区分なしで書かれた付与も拾いたい fork は上書きの一覧に `"other"` を足せる（その場合、導入前の期間の値は信用しない）
- **数える通貨** = `src/domains/core/analytics/config.ts` の `coinIssuanceWalletTypes`（既定 `["regular_coin"]`）。仕組みはどの通貨にも使え、このまとめに数える通貨だけを config で選ぶ（単位の違う通貨を同じ合計に入れない）
- **内訳（breakdown、表示だけ）**: `wallet_bonus_grant` は付与の種類（`reason_key`）ごとの行を `sources.wallet_bonus_grant.breakdown` に返す（`{ key, label, current, previous, changeRate }`、key null = 「未分類」、並び = 種類の sortOrder → 未分類は最後）。行の和 = そのソースの値。aggregator は合計（`totalIssuance` / `finalProfit`）に breakdown を使わない。画面は「販促・特典付与 = 合計」の下に行を並べる
  - 自前のソースも `aggregate()` の戻り値に `breakdown?: CoinIssuanceBreakdownRow[]` を返せる（規約: 表示だけ・行の和はソースの値と一致させる・どの行にも入らない分は key null に寄せる）
  - 過去の行は種類が無く「未分類」に入る。種類を埋める task は src/domains/core/wallet/Extension.md「付与の種類（reason key）」
- 付与の `reasonKey`（付与の種類。区分は種類から決まる）か `reasonCategory`（`walletService.adjustBalance` 等）を書かない行は `other` になり、既定ではこのまとめに入らない（src/domains/core/wallet/Extension.md「付与の種類（reason key）」）

2 つとも `enabled` で門番の入切を見る（`purchase_bonus_gap` = `gate.enabled("payment")`・`wallet_bonus_grant` = `gate.enabled("wallet")`）。閉じている間は走らず、応答の `sources` に出ない
