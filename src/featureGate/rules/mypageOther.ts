// src/featureGate/rules/mypageOther.ts
// その他の操作(休会・退会の入口。どちらも無効なら中身が無い)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  // マイページの画面の一部(マイページを閉じれば一緒に閉じる)
  dependsOn: ["pageMypage"],
  // 休会か退会のどちらかが開なら開(どちらも閉なら中身が無い。D36)
  anyOf: ["pause", "withdraw"],
  pathPatterns: ["/mypage/other"],
  defaultEnabled: true,
};
