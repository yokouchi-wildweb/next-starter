// 紹介報酬の設定
//
// ベースリポジトリの項目は 0。下流プロジェクトで報酬を追加する:
// 1. 自分のドメインの plugs/referralRewardRewardGroups/<名前>.ts に export const group(key・label・rewards)
// 2. 自分のドメインの plugs/referralRewardRewardHandlers/<名前>.ts に export const handler(rewardKey・handler)
// 3. pnpm generate extensions
// 4. 任意のタイミングで triggerRewards(trigger, referral, context?, tx?) を呼ぶ

import { referralRewardRewardGroups } from "./extensions/referralRewardRewardGroups";
import type { ReferralRewardGroup } from "./types/rewardConfig";

/**
 * 報酬グループ定義マップ（点 referralRewardRewardGroups の全項目）
 * key = グループキー（管理画面でのグルーピング単位）
 * 保存した報酬の行(reward_key)の鍵の定義なので門番で絞らない(設定の欄と同じ、D26)。報酬を始めるかは getRewardKeysByTrigger が門番で絞る
 */
export const REFERRAL_REWARD_DEFINITIONS: Readonly<Record<string, ReferralRewardGroup>> = Object.assign(
  Object.create(null),
  Object.fromEntries(referralRewardRewardGroups.map((entry) => [entry.plug.key, entry.plug])),
);
