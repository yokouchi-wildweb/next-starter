// マイルストーン定義の読み手(項目: ./definitions/<名前>[.<fork の名前>].ts の export const milestone、一覧は生成物)
// ベースリポジトリの項目は 0。
//
// 使い方（下流プロジェクト）:
// ```ts
// export const milestone: MilestoneDefinition = {
//   key: "first_purchase",
//   triggers: ["purchase_completed"],
//   evaluate: async ({ userId }, tx) => {
//     const { data } = await purchaseRequestService.search({ ... });
//     return data.length === 1;
//   },
//   onAchieved: async ({ userId, tx }) => {
//     await walletService.adjustBalance({ userId, ... }, tx);
//     return { reward: "500 coins" };
//   },
// };
// ```

import { definitions } from "@/features/core/milestone/extensions/definitions";

import type { MilestoneDefinition } from "../../types/milestone";

let memo: Map<string, MilestoneDefinition> | null = null;

// key の重複は例外。読み込みの途中で一覧を触らないよう初回に組み立てる
function registry(): Map<string, MilestoneDefinition> {
  if (memo) return memo;
  const map = new Map<string, MilestoneDefinition>();
  for (const definition of definitions) {
    if (map.has(definition.key)) {
      throw new Error(`マイルストーン "${definition.key}" が複数あります。キーが重複しないようにしてください。`);
    }
    map.set(definition.key, definition);
  }
  memo = map;
  return map;
}

/**
 * 指定トリガーに紐づくマイルストーン定義を取得する
 *
 * @param trigger トリガー名
 * @returns マイルストーン定義の配列
 */
export function getMilestonesByTrigger(trigger: string): MilestoneDefinition[] {
  return [...registry().values()].filter((d) => d.triggers.includes(trigger));
}

/**
 * 指定キーのマイルストーン定義を取得する
 *
 * @param key マイルストーンキー
 * @returns マイルストーン定義、未登録の場合は undefined
 */
export function getMilestoneByKey(key: string): MilestoneDefinition | undefined {
  return registry().get(key);
}

/**
 * 登録済みの全マイルストーン定義を取得する
 */
export function getAllMilestones(): MilestoneDefinition[] {
  return [...registry().values()];
}
