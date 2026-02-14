// 報酬ハンドラーの登録エントリポイント
//
// 下流プロジェクトでハンドラーを追加する場合:
// 1. handlers/ 配下にハンドラーファイルを作成
// 2. このファイルで registerRewardHandler() を呼んで登録
//
// 例:
// import { registerRewardHandler } from "./registry";
// import { signupInviterBonus } from "./signupInviterBonus";
// registerRewardHandler("signup_inviter_bonus", signupInviterBonus);

export { registerRewardHandler, getRewardHandler, hasRewardHandler } from "./registry";
export type { RewardHandler } from "./registry";
