// src/features/core/auth/services/server/postRegistrationMilestones.ts
//
// 本登録の後の処理(登録ボーナスなど)の発火点。新しい受け口は作らず、milestone の統合ポイント
// (トリガー user_registered)で受ける: fork は milestone/services/server/definitions/ にマイルストーン定義を置く。
// - 1 人 1 回: milestones の user_id + milestone_key のユニーク(退会後の再登録など同じ users.id の
//   2 度目の本登録では達成済みで走らない)
// - 付与と記録は同じ tx: onAchieved に渡る tx で付与すれば、記録に失敗したとき(同時の 2 回目)付与も巻き戻る
// - 失敗しても登録は止めない(登録は確定済み。ここで巻き戻さない)。定義ごとの失敗は evaluateMilestones の SAVEPOINT で分離
// 詳細: src/features/core/milestone/README.md「統合ポイント一覧」

import { gate } from "@/featureGate";
import type { User } from "@/features/core/user/entities";
import type { RegistrationInviteCodeResult } from "@/features/core/auth/entities/registration";
import { MILESTONE_TRIGGER_USER_REGISTERED } from "@/features/core/milestone/constants/triggers";
import { getMilestonesByTrigger } from "@/features/core/milestone/services/server/milestoneRegistry";
import { evaluateMilestones } from "@/features/core/milestone/services/server/wrappers/evaluateMilestones";
import { runWithTransaction } from "@/lib/drizzle";

/** user_registered のマイルストーンに渡す payload(定義の context.payload) */
export type UserRegisteredPayload = {
  /** 本登録後の利用者 */
  user: User;
  /** 本登録のロール */
  role: string;
  /** 認証手段("email" など) */
  providerType: string;
  /** 招待コードの適用結果(null = 指定なし)。招待の成否で分けたい定義が見る */
  inviteCode: RegistrationInviteCodeResult | null;
};

/**
 * 本登録の後に user_registered のマイルストーンを評価する。throw しない(失敗はログだけ)。
 * 定義が無ければ tx を開かない。マイルストーンの機能が閉じているときは何もしない
 */
export async function runPostRegistrationMilestones(payload: UserRegisteredPayload): Promise<void> {
  if (!gate.enabled("milestone")) return;
  try {
    if (getMilestonesByTrigger(MILESTONE_TRIGGER_USER_REGISTERED).length === 0) return;
    await runWithTransaction(undefined, (tx) =>
      evaluateMilestones(
        MILESTONE_TRIGGER_USER_REGISTERED,
        { userId: payload.user.id, payload: { ...payload } },
        tx,
      ),
    );
  } catch (error) {
    console.error("[registration] 登録後のマイルストーンの評価に失敗しました（登録は続行）:", error);
  }
}
