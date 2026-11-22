// src/domains/core/referralReward/extensionPoints.ts
// referralReward の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 報酬グループ: <ドメイン>/plugs/referralRewardRewardGroups/<名前>.ts の export const group(上流の項目は 0)
  referralRewardRewardGroups: {
    change: "add",
    plugs: true,
    export: "group",
    type: { from: "@/domains/core/referralReward/types/rewardConfig", name: "ReferralRewardGroupItem" },
    side: "shared",
    key: "key",
  },
  // 報酬ハンドラー: <ドメイン>/plugs/referralRewardRewardHandlers/<名前>.ts の export const handler(上流の項目は 0)
  referralRewardRewardHandlers: {
    change: "add",
    plugs: true,
    export: "handler",
    type: { from: "@/domains/core/referralReward/services/server/rewardHandlerRegistry", name: "RewardHandlerItem" },
    side: "server",
  },
};
