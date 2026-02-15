// マイルストーンレジストリ
//
// 下流プロジェクトがマイルストーンの定義を登録するためのレジストリ。
// ベースリポジトリではレジストリ機構のみ提供し、マイルストーンは登録しない。
//
// 使い方（下流プロジェクト）:
// ```ts
// import { registerMilestone } from "@/features/core/milestone/services/server/milestoneRegistry";
//
// registerMilestone({
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
// });
// ```

import type { MilestoneDefinition } from "../../types/milestone";

/** マイルストーン定義の内部ストア */
const registry = new Map<string, MilestoneDefinition>();

/**
 * マイルストーンを登録する
 *
 * @param definition マイルストーン定義
 * @throws key が重複している場合
 */
export function registerMilestone(definition: MilestoneDefinition): void {
  if (registry.has(definition.key)) {
    throw new Error(
      `マイルストーン "${definition.key}" は既に登録されています。キーが重複していないか確認してください。`,
    );
  }
  registry.set(definition.key, definition);
}

/**
 * 指定トリガーに紐づくマイルストーン定義を取得する
 *
 * @param trigger トリガー名
 * @returns マイルストーン定義の配列
 */
export function getMilestonesByTrigger(trigger: string): MilestoneDefinition[] {
  return [...registry.values()].filter((d) => d.triggers.includes(trigger));
}

/**
 * 指定キーのマイルストーン定義を取得する
 *
 * @param key マイルストーンキー
 * @returns マイルストーン定義、未登録の場合は undefined
 */
export function getMilestoneByKey(key: string): MilestoneDefinition | undefined {
  return registry.get(key);
}

/**
 * 登録済みの全マイルストーン定義を取得する
 */
export function getAllMilestones(): MilestoneDefinition[] {
  return [...registry.values()];
}
