// 指定ユーザーに新規クーポンコードを発行

import { db } from "@/lib/drizzle";
import { CouponTable } from "../../../entities/drizzle";
import type { Coupon } from "../../../entities/model";
import { generateCouponCode } from "../../../utils/generateCode";
import { isPgUniqueViolation } from "@/lib/crud/drizzle/service";
import { DomainError } from "@/lib/errors/domainError";
import type { TransactionClient } from "@/lib/drizzle/transaction";

export type CouponTypeWithOwner = "invite" | "affiliate";

export type IssueCodeParams = {
  attributionUserId: string;
  type: CouponTypeWithOwner;
  name: string;
  description?: string;
  imageUrl?: string;
  adminLabel?: string;
  adminNote?: string;
  maxTotalUses?: number | null;
  maxUsesPerRedeemer?: number | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
};

const MAX_RETRY = 5;

/**
 * 指定ユーザーに新規クーポンコードを発行
 *
 * - コード自動生成（衝突時リトライ）
 * - type: invite / affiliate のみ（official は owner_id: null なので別処理）
 *
 * @param params 発行パラメータ
 * @param tx 外部トランザクション（オプション）
 */
export async function issueCodeForOwner(
  params: IssueCodeParams,
  tx?: TransactionClient
): Promise<Coupon> {
  const executor = tx ?? db;

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const code = generateCouponCode();

    try {
      const [created] = await executor
        .insert(CouponTable)
        .values({
          code,
          type: params.type,
          status: "active",
          name: params.name,
          description: params.description ?? null,
          image_url: params.imageUrl ?? null,
          admin_label: params.adminLabel ?? null,
          admin_note: params.adminNote ?? null,
          attribution_user_id: params.attributionUserId,
          max_total_uses: params.maxTotalUses ?? null,
          max_uses_per_redeemer: params.maxUsesPerRedeemer ?? null,
          valid_from: params.validFrom ?? null,
          valid_until: params.validUntil ?? null,
          current_total_uses: 0,
        })
        .returning();

      return created as Coupon;
    } catch (error) {
      // コード重複の場合はリトライ
      if (isPgUniqueViolation(error)) {
        lastError = error;
        continue;
      }
      // その他のエラーはそのままスロー
      throw error;
    }
  }

  // リトライ上限に達した
  throw new DomainError("クーポンコードの生成に失敗しました。再度お試しください。", {
    status: 500,
  });
}
