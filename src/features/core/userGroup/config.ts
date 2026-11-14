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
};

const defaults: UserGroupConfig = {
  memberLimit: 100_000,
  definition: { maxNodes: 50, maxDepth: 6 },
};

export const userGroupConfigDef = defineConfig(defaults, { label: "userGroup" });

/** 上書きのファイルの型(`export default { ... } satisfies UserGroupOverride`) */
export type UserGroupOverride<E extends object = Record<never, never>> = OverrideOf<typeof userGroupConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const userGroupConfig: UserGroupConfig = userGroupConfigDef.compose(override);
