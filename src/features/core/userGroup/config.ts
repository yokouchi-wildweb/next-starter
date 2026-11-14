// src/features/core/userGroup/config.ts
// ユーザーグループの値(既定 + 上書き)。上書きは src/config/features/userGroup.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。入切のスイッチではない(入切は門 userGroups)

import override from "@/config/features/userGroup.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type UserGroupConfig = {
  /**
   * グループの人数の上限(D102)。グループ宛ての送信が送り始めに書き出す人数と、静的グループに入れる人数に効く。
   * 超える時は送る前・作る前に理由つきで止める(黙って途中で切らない)。管理画面の人数の見込みにも出す
   */
  memberLimit: number;
  /**
   * 条件の定義の木の上限(D103)
   * - maxNodes: 節の数(and / or / not と部品の葉を全部数える)
   * - maxDepth: 深さ(根 = 1)。管理画面は 2 段まで組め、それより深い定義は読むだけ
   */
  definition: { maxNodes: number; maxDepth: number };
  /**
   * 評価の口(count・isMember・listMemberIds・evaluate)
   * - timeoutMs: 数え・見込み・動的の列挙の 1 文の時間の上限(statement_timeout)。超えると 503(条件を絞るか定期計算に)
   * - listLimitMax: listMemberIds の 1 回の件数の上限
   * - sampleLimit: evaluate が返す試しの一覧の件数
   */
  evaluation: { timeoutMs: number; listLimitMax: number; sampleLimit: number };
  /**
   * 静的グループへ書く口(replaceMembers・addMembers・removeMembers)
   * - batchSize: 1 つの束で書く利用者の数(置き換えの下書き・足す・外すの 1 文)
   */
  write: { batchSize: number };
  /**
   * 定期計算(cron user-group-recompute)
   * - budgetMs: 1 回の実行の時間の予算(createDeadline)。尽きたら次の回に版の再開の位置から続ける
   * - batchSize: 1 つの束で版に書く利用者の数
   * - defaultIntervalMinutes: グループの間隔(recompute_interval_minutes)が null の時の間隔。cron は毎時なので、細かい値は次の毎時に丸まる
   */
  recompute: { budgetMs: number; batchSize: number; defaultIntervalMinutes: number };
  /**
   * 管理の API(/api/admin/user-groups)
   * - listCountTimeoutMs: 一覧で動的グループの人数を数える 1 件の時間の上限。超えると「未計算」の印
   * - listCountBudgetMs: 一覧の 1 ページで動的グループの人数を数える合計の時間。尽きたら残りは「未計算」
   * - freezeBudgetMs: 静的グループを作る・置き換える 1 回の要求の時間(route の maxDuration 60 秒の内側)。
   *   終わらなければ incomplete を返し、画面が同じ要求を送り直すと続きから書く
   * - optionsLimit: 条件の部品の選択肢(タグ・静的グループ)の件数の上限
   */
  admin: { listCountTimeoutMs: number; listCountBudgetMs: number; freezeBudgetMs: number; optionsLimit: number };
};

const defaults: UserGroupConfig = {
  memberLimit: 100_000,
  definition: { maxNodes: 50, maxDepth: 6 },
  evaluation: { timeoutMs: 10_000, listLimitMax: 1000, sampleLimit: 20 },
  write: { batchSize: 1000 },
  recompute: { budgetMs: 240_000, batchSize: 1000, defaultIntervalMinutes: 1440 },
  admin: { listCountTimeoutMs: 1000, listCountBudgetMs: 3000, freezeBudgetMs: 50_000, optionsLimit: 500 },
};

export const userGroupConfigDef = defineConfig(defaults, { label: "userGroup" });

/** 上書きのファイルの型(`export default { ... } satisfies UserGroupOverride`) */
export type UserGroupOverride<E extends object = Record<never, never>> = OverrideOf<typeof userGroupConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const userGroupConfig: UserGroupConfig = userGroupConfigDef.compose(override);
