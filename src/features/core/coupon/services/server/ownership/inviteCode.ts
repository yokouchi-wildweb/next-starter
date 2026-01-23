// 招待コード専用ヘルパー（1ユーザー1コード制約）

import type { Coupon } from "../../../entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { runWithTransaction } from "@/lib/drizzle/transaction";
import { getCodesByOwner } from "./getCodesByOwner";
import { issueCodeForOwner } from "./issueCodeForOwner";

/**
 * 招待コードのデフォルト設定
 */
const INVITE_CODE_DEFAULTS = {
  name: "招待コード",
  maxUsesPerRedeemer: 1, // 1人1回まで使用可能
} as const;

/**
 * ユーザーの招待コードを取得（発行しない）
 *
 * @param userId ユーザーID
 * @param tx 外部トランザクション（オプション）
 */
export async function getInviteCode(
  userId: string,
  tx?: TransactionClient
): Promise<Coupon | null> {
  const codes = await getCodesByOwner(
    {
      attributionUserId: userId,
      type: "invite",
      includeInactive: false,
    },
    tx
  );

  return codes[0] ?? null;
}

/**
 * ユーザーの招待コードを取得（なければ自動発行）
 *
 * - 1ユーザー1コード制約
 * - マイページアクセス時に呼ぶ想定
 * - レースコンディション対策済み（トランザクション内で処理）
 *
 * @param userId ユーザーID
 * @param tx 外部トランザクション（オプション）
 */
export async function getOrCreateInviteCode(
  userId: string,
  tx?: TransactionClient
): Promise<Coupon> {
  return runWithTransaction(tx, async (trx) => {
    // 既存コードを確認
    const existing = await getInviteCode(userId, trx);
    if (existing) {
      return existing;
    }

    // なければ新規発行
    const created = await issueCodeForOwner(
      {
        attributionUserId: userId,
        type: "invite",
        name: INVITE_CODE_DEFAULTS.name,
        maxUsesPerRedeemer: INVITE_CODE_DEFAULTS.maxUsesPerRedeemer,
      },
      trx
    );

    return created;
  });
}
