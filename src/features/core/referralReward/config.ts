// 紹介報酬の設定
//
// ベースリポジトリの項目は 0。下流プロジェクトで報酬を追加する:
// 1. rewardGroups/<名前>.<fork の名前>.ts に export const group(key・label・rewards)
// 2. services/server/handlers/<名前>.<fork の名前>.ts に export const handler(rewardKey・handler)
// 3. pnpm extensions:generate
// 4. 任意のタイミングで triggerRewards(trigger, referral, context?, tx?) を呼ぶ

import { rewardGroups } from "./extensions/rewardGroups";
import type { ReferralRewardGroup } from "./types/rewardConfig";

/**
 * 報酬グループ定義マップ（一覧 rewardGroups そのもの）
 * key = グループキー（管理画面でのグルーピング単位）
 */
export const REFERRAL_REWARD_DEFINITIONS: Readonly<Record<string, ReferralRewardGroup>> = rewardGroups;
