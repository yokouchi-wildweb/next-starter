# milestone（マイルストーンフレームワーク）

## Overview

- ユーザーが特定の条件を達成したことを検知・記録し、達成時に任意の処理を実行する汎用フレームワーク
- 上流は仕組みだけを持つ。具体的なマイルストーン定義は下流が受け口に置く
- 閉じられる機能: 門番の規則 `src/featureGate/rules/milestone.ts`(既定は閉 `defaultEnabled: false`、fork は `src/config/featureGate/switches.config.ts` で開ける)。閉じたときの統合ポイント: 決済の完了は評価せず結果は空・本登録の後(user_registered)は何もしない

## Usage

### 1. マイルストーン定義を置く

`services/server/definitions/<名前>.ts` を置き、`pnpm generate extensions`(`extensions/definitions.ts` に入る)。これだけで `evaluateMilestones()` の呼び出しで評価される。

```ts
// services/server/definitions/firstPurchase.ts

import type { MilestoneDefinition } from "@/features/core/milestone/types/milestone";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";

export const milestone: MilestoneDefinition = {
  key: "first_purchase",
  triggers: ["purchase_completed"],

  // 条件: 完了済み購入が1件（= 今回が初回）
  // 第2引数の tx でトランザクション内の最新状態を参照可能
  evaluate: async ({ userId }, tx) => {
    const { results } = await purchaseRequestService.search({
      where: {
        and: [
          { field: "user_id", op: "eq", value: userId },
          { field: "status", op: "eq", value: "completed" },
        ],
      },
      limit: 1,
      page: 1,
    });
    return results.length === 1;
  },

  // 達成時: 紹介報酬をトリガー
  onAchieved: async ({ userId, tx }) => {
    // 例: referralReward と連携
    // const referral = await referralService.findByInvitee(userId, tx);
    // if (referral) await triggerRewards("first_purchase", referral, {}, tx);
    return { note: "初回購入達成" };
  },
};
```

### 2. 段階のあるシリーズ(1 項目で段階の並びを持つ)

ランクのように「段階ごとに達成がある」物は、段階ごとのファイルを並べず 1 項目のシリーズにする(欄は `API.md`「シリーズの欄」)。

```ts
// services/server/definitions/rankUp.ts
import { defineMilestoneSeries } from "@/features/core/milestone/types/milestone";

export const milestone = defineMilestoneSeries({
  kind: "series",
  key: "rank_up",
  triggers: ["purchase_completed"],
  order: "sequential",
  stages: () => getRankTiers(),                 // [{ key: "bronze", threshold: 3000, bonus: 100 }, …] を設定から
  stageKey: (tier) => `rank_${tier.key}`,       // 段階の名前から(記録済みの鍵と同じ形を保つ)
  evaluate: async (tier, { userId }, tx) => (await totalPurchased(userId, tx)) >= tier.threshold,
  onAchieved: async (tier, { userId, tx }) => grantRankBonus(userId, tier, tx),
});
```

- 段階を消すと、その段階はもう評価されない。記録済みの達成は残る(項目のファイルを消したときと同じ)
- 鍵の重複は読み手が例外にする: 普通の定義・段階の鍵・シリーズの鍵のどれどうしでも、シリーズをまたいでも。`stageKey` が空でも例外

### レシピ: ランク(段階のあるシリーズ)

```ts
// services/server/definitions/rankUp.ts
import { defineMilestoneSeries } from "@/features/core/milestone/types/milestone";
import { getRankTiers } from "@/features/rankUp/services/server/rank/rankConfig";   // 設定のティア [{ key: "bronze", threshold, bonus }, …]

export const milestone = defineMilestoneSeries({
  kind: "series",
  key: "rank_up",
  triggers: ["purchase_completed"],
  order: "sequential",
  stages: () => getRankTiers().filter((tier) => tier.threshold > 0),   // 設定に足したティアは次の評価から入る
  stageKey: (tier) => `rank_${tier.key}`,                              // 名前から(番号にしない。記録済みの rank_<名前> と同じ)
  evaluate: async (tier, { userId }, tx) => (await totalPurchased(userId, tx)) >= tier.threshold,
  onAchieved: async (tier, { userId, tx, series }) => {
    // 一度に 2 段越えた下の段のボーナスも付ける(省くなら series?.viaHigherStage を見て return)
    await walletService.adjustBalance({ userId, amount: tier.bonus, reasonKey: "rank_up_bonus" }, tx);
    return { rank: tier.key, bonus: tier.bonus };
  },
});

// 今のランクと次: const p = await getMilestoneSeriesProgress(userId, "rank_up"); p?.achievedKeys.at(-1) / p?.next
// 通知: components/renderers/rankUp.tsx に key: "rank_up" のレンダラー 1 つ(seriesResults で越えた段を描く)
```

### レシピ: 登録ボーナス(金額は管理画面で変えられる setting の項目、付与は定義 1 つ)

```ts
// 1. src/features/core/setting/fields/signupBonusCoinAmount.ts（setting の項目の受け口。書式は setting README）
// 2. src/features/core/milestone/services/server/definitions/signupBonus.ts → pnpm generate extensions
import { gate } from "@/featureGate";
import type { MilestoneDefinition } from "@/features/core/milestone/types/milestone";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { walletService } from "@/features/core/wallet/services/server/walletService";

export const milestone: MilestoneDefinition = {
  key: "signup_bonus",
  triggers: ["user_registered"],
  evaluate: async () => {
    if (!gate.enabled("wallet")) return false; // wallet を閉じている間は表が無い
    const setting = await settingService.getGlobalSetting();
    return (setting.signupBonusCoinAmount ?? 0) > 0;
  },
  onAchieved: async ({ userId, tx }) => {
    const setting = await settingService.getGlobalSetting();
    const amount = setting.signupBonusCoinAmount ?? 0;
    // tx を渡す: 付与と達成の記録が同時に確定する（二重付与しない）
    await walletService.adjustBalance(
      {
        userId,
        walletType: "regular_coin",
        changeMethod: "INCREMENT",
        amount,
        sourceType: "system",
        reason: "新規登録ボーナス",
        // 付与の種類（walletHistory/reasonKeys/signupBonus.ts に { key: "signup_bonus", label: "登録ボーナス", category: "bonus" }）。
        // 区分（bonus）は種類から決まる。wallet README「付与の種類」
        reasonKey: "signup_bonus",
      },
      tx,
    );
    return { amount };
  },
};
```

### 独自トリガーを足す

上流の統合ポイント以外にも、下流が独自にトリガーを足せる。

1. トリガー名の定数を定義（任意の場所）

```ts
export const MILESTONE_TRIGGER_USER_VERIFIED = "user_verified";
```

2. 適切な場所で `evaluateMilestones()` を呼び出す

```ts
import { evaluateMilestones } from "@/features/core/milestone/services/server/wrappers/evaluateMilestones";

// 本人確認完了後
await evaluateMilestones("user_verified", {
  userId,
  payload: { verifiedAt: new Date() },
});
```

3. そのトリガーに反応するマイルストーンを定義

```ts
export const milestone: MilestoneDefinition = {
  key: "identity_verified",
  triggers: ["user_verified"],
  evaluate: async () => true,  // トリガー発生 = 即達成
  onAchieved: async ({ userId }) => {
    // 報酬付与など
  },
};
```

### 達成の通知を描く(レンダラー)

1. レンダラーの部品を責務のドメインに作る

```tsx
// src/features/myDomain/components/FirstPurchaseCelebration.tsx

"use client";

import type { MilestoneRendererProps } from "@/features/core/milestone/types/milestoneRenderer";

export function FirstPurchaseCelebration({ result }: MilestoneRendererProps) {
  const bonus = result.metadata?.reward as string | undefined;
  return (
    <div>
      <p>初回購入おめでとうございます！</p>
      {bonus && <p>ボーナス: {bonus}</p>}
    </div>
  );
}
```

2. 受け口 `components/renderers/<名前>.ts` に項目を置き、`pnpm generate extensions`

```ts
// components/renderers/firstPurchase.ts

import type { MilestoneRendererDefinition } from "@/features/core/milestone/types/milestoneRenderer";
import { FirstPurchaseCelebration } from "@/features/myDomain/components/FirstPurchaseCelebration";

export const renderer: MilestoneRendererDefinition = {
  key: "first_purchase",          // マイルストーン定義の key と一致させる(同じ key は読み込み時に例外)
  component: FirstPurchaseCelebration,
  priority: 10,                   // 小さいほど先に表示（デフォルト: 0）
  // displayMode: "modal",        // モーダル表示にする場合
};
```

- モーダル型(`displayMode: "modal"`)の部品は、自身でモーダルの表示 / 非表示を持つ
- シリーズの段をまとめて描くレンダラーは `key` にシリーズの鍵を書く(props は `API.md`「レンダラー」)

### 表示する場所

達成をどこで見せるかは業務の判断なので、上流の画面(購入完了の `PurchaseComplete` を含む)は `MilestoneNotifications` を描かない。達成の結果は購入の状態の API・`usePurchaseStatus` の `milestoneResults` にそのまま入る。

- 画面に出す: fork の route の `_components/` の Screen に置く。機能が閉じたときは描かないよう門番を確かめる
  ```tsx
  const showMilestones = useGate().enabled("milestone");
  {showMilestones && purchaseInfo?.milestoneResults?.length ? (
    <MilestoneNotifications results={purchaseInfo.milestoneResults} />
  ) : null}
  ```
- 画面に出さない: 定義の `onAchieved` で別の経路(アプリ内通知など)へ送る

## API

- シリーズの欄・進み具合・評価のコンテキスト・統合ポイントの payload・結果の型・レンダラーの props: `API.md`

## Extension

- マイルストーン定義: 受け口 `services/server/definitions/<名前>.ts` の `export const milestone`(型 `MilestoneItem`、上流の項目は 0)
- 達成通知のレンダラー: 受け口 `components/renderers/<名前>.ts(x)` の `export const renderer`(型 `MilestoneRendererDefinition`、上流の項目は 0 = 全キーが既定の通知 `DefaultMilestoneNotification`)
- どちらも置いた・消したら `pnpm generate extensions`(仕組み: `scripts/structure/extensions/README.md`)

## Internals

### 評価の流れ

```
イベント発生（購入完了など）
  ↓
evaluateMilestones(trigger, { userId, payload }, tx?)
  ↓
登録済みマイルストーン(シリーズは段階ごとに展開済み)のうち、該当 trigger を持つものをループ
  ↓ 各マイルストーンについて:
  ① milestones テーブルで達成済みか確認 → 済みならスキップ
  ② evaluate(context, tx?) で条件を評価 → false ならスキップ
  ③ 記録を確定: milestones に insert … on conflict (user_id, milestone_key) do nothing
     → 行が返らなければ並走が先に記録した = ④ を呼ばない(二重の付与を防ぐ)
  ④ onAchieved()（報酬付与など。記録と同じ tx）→ 戻り値を metadata に保存
  ③④ は 1 件ごとに SAVEPOINT(tx あり)か db.transaction(tx なし)の中。④ が投げると記録も戻る
```

- **シリーズの評価の順**: `order: "sequential"` は段階の並び順に評価し、段階が達成したら、その下に残る未達成の段を**下から順に先に**達成させる(1 回の購入でランクを 2 つ越えたら下の段も記録・付与)。その下の段の `onAchieved` の `params.series` は `{ …印, reachedStageKey: 達成した上の段, viaHigherStage: true }`。下の段の付与を省きたいシリーズは `viaHigherStage` を見て省く(記録はされる)。`"unordered"` と普通の定義は各々独立に評価する
- **この評価で達成済みの鍵**: `context.achievedInThisEvaluation`(`ReadonlySet<string>`)に、同じ評価で先に達成した鍵が入る(後の定義・段階の evaluate が前の達成を見るとき)

### 通知の描き方

```
completePurchase() で milestone_results を jsonb に保存
  ↓
/api/wallet/purchase/[id]/status のレスポンスに milestoneResults を含める
  ↓
表示する fork が自分の画面に置いた MilestoneNotifications が描画(上流の画面は描かない。下の「表示する場所」)
  ↓
各マイルストーンについて:
  ① レンダラーレジストリから該当キーのレンダラーを検索
  ② displayMode で分離:
     - inline（デフォルト）→ リスト内にインライン表示
     - modal → リストから除外し、別途モーダルとして描画
  ③ 登録済み → そのコンポーネントで描画
  ④ 未登録 → DefaultMilestoneNotification（汎用通知）で描画
```

### 冪等・分離・トランザクション

- **冪等性**: `user_id + milestone_key` のユニーク制約で、同じマイルストーンが二重に記録されることはない。記録を確定してから `onAchieved` を呼ぶので、同時に 2 回評価されても付与は 1 回(記録を取れた側だけが呼ぶ)
- **エラー分離**: 個別マイルストーンの evaluate/onAchieved でエラーが発生しても、他のマイルストーンの評価は継続する。tx がある場合は PostgreSQL の SAVEPOINT で分離されるため、DB エラーがトランザクション全体を汚染しない
- **トランザクション**: `completePurchase` から呼ばれる場合は既存の tx が渡される。マイルストーンの記録と購入処理が同一トランザクションで実行される。evaluate にも tx が渡されるため、トランザクション内の最新状態を参照可能。tx を渡さない呼び出しでも記録と `onAchieved` は 1 件ごとの `db.transaction` の中で、`onAchieved` の `params.tx` にそれが渡る(付与は `params.tx` で書く)。メールなど DB の外の副作用は戻らないので、tx の後で送る形にする
- **パフォーマンス**: 登録マイルストーンが0件の場合、`evaluateMilestones` は即座に空配列を返す（オーバーヘッドなし）
- **user_id に FK なし**: ユーザー削除後も達成記録は保持される

## Verification

- 評価: `pnpm test src/features/core/milestone/services/server/wrappers/evaluateMilestones.test.ts`、実 DB(同時実行・巻き戻し・飛ばし): `pnpm test --db src/features/core/milestone/services/server/wrappers/evaluateMilestones.db.test.ts`
- シリーズの読み手: `pnpm test src/features/core/milestone/services/server/milestoneRegistry.test.ts`
- 進み具合: `pnpm test src/features/core/milestone/services/server/wrappers/getMilestoneSeriesProgress.test.ts`
- 通知: `pnpm test src/features/core/milestone/components/MilestoneNotifications.render.test.tsx`

## Related

### referralReward との関係

| | referralReward | milestone |
|---|---|---|
| 用途 | 紹介関係に基づく報酬配布 | 任意の条件達成の検知・記録 |
| トリガー | 明示的に `triggerRewards()` を呼ぶ | イベント発生時に自動評価 |
| 条件判定 | トリガー名でマッチ（条件なし） | `evaluate()` で動的に判定 |
| 冪等性 | `referral_id + reward_key` | `user_id + milestone_key` |

マイルストーンの `onAchieved` 内から `triggerRewards()` を呼ぶことで連携可能。
