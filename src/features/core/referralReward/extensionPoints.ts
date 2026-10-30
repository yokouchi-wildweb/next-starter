// src/features/core/referralReward/extensionPoints.ts
// referralReward の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 報酬グループ: rewardGroups/<名前>[.<fork の名前>].ts の export const group(上流の項目は 0)
  rewardGroups: {
    dir: "rewardGroups",
    export: "group",
    type: { from: "@/features/core/referralReward/types/rewardConfig", name: "ReferralRewardGroupItem" },
    side: "shared",
    key: "key",
  },
  // 報酬ハンドラー: services/server/handlers/<名前>[.<fork の名前>].ts の export const handler(上流の項目は 0)
  rewardHandlers: {
    dir: "services/server/handlers",
    export: "handler",
    type: { from: "@/features/core/referralReward/services/server/rewardHandlerRegistry", name: "RewardHandlerItem" },
    side: "server",
  },
};
