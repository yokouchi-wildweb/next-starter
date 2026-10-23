// 指定ユーザーに新規クーポンコードを発行

import { CouponTable } from "../../../entities/drizzle";
import type { Coupon } from "../../../entities/model";
import { generateCouponCode } from "../../../utils/generateCode";
import { isPgUniqueViolation } from "@/lib/crud/drizzle/service";
import { DomainError } from "@/lib/errors/domainError";
import { runWithTransaction, type TransactionClient } from "@/lib/drizzle/transaction";
import { isStorageRef } from "@/lib/storage";
import { storageObjectService } from "@/features/core/storageObject/services/server/storageObjectService";

/** coupon.image_url の用途（drizzleBase の storage binding と同じ） */
const COUPON_IMAGE_PURPOSE = "coupon.image_url";

export type CouponTypeWithOwner = "invite" | "affiliate";

export type IssueCodeParams = {
  attributionUserId: string;
  type: CouponTypeWithOwner;
  name: string;
  category?: string | null;
  description?: string;
  /**
   * 画像。storage ref なら発行するクーポンごとに複製して紐付ける（元の行と ref を共有しない）。
   * ref 以外の値（固定の URL など）はそのまま保存する
   */
  imageUrl?: string;
  adminLabel?: string;
  adminNote?: string;
  maxTotalUses?: number | null;
  maxUsesPerRedeemer?: number | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  /** カテゴリハンドラーが参照する設定値（省略時 {}） */
  settings?: Record<string, unknown>;
};

const MAX_RETRY = 5;

/**
 * 指定ユーザーに新規クーポンコードを発行
 *
 * - コード自動生成（衝突時リトライ）
 * - type: invite / affiliate のみ（official は owner_id: null なので別処理）
 * - imageUrl が storage ref なら、TX の外で先に複製（owner なし）し、insert と同じ TX で台帳に紐付ける。
 *   複製に失敗したら発行しない（黙って画像なしにしない）。発行に失敗した複製は未紐付けのまま掃除で消える
 *
 * @param params 発行パラメータ
 * @param tx 外部トランザクション（オプション）
 */
export async function issueCodeForOwner(
  params: IssueCodeParams,
  tx?: TransactionClient
): Promise<Coupon> {
  // 複製は長い業務 TX の外で先に行う（storageObjectService.copy は呼び出し側で認可済みの前提。発行は server 内部の操作）
  const imageRef =
    params.imageUrl && isStorageRef(params.imageUrl)
      ? (await storageObjectService.copy({ source: params.imageUrl, purpose: COUPON_IMAGE_PURPOSE, ownerUserId: null }))
          .ref
      : null;
  const imageUrl = imageRef ?? params.imageUrl ?? null;

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const code = generateCouponCode();

    try {
      // 外側の tx が無ければ試行ごとに TX を張る（コード重複で失敗した TX を次の試行に持ち越さない）
      const created = await runWithTransaction(tx, async (executor) => {
        const [row] = await executor
          .insert(CouponTable)
          .values({
            code,
            type: params.type,
            category: params.category ?? null,
            status: "active",
            name: params.name,
            description: params.description ?? null,
            image_url: imageUrl,
            admin_label: params.adminLabel ?? null,
            admin_note: params.adminNote ?? null,
            attribution_user_id: params.attributionUserId,
            max_total_uses: params.maxTotalUses ?? null,
            max_uses_per_redeemer: params.maxUsesPerRedeemer ?? null,
            valid_from: params.validFrom ?? null,
            valid_until: params.validUntil ?? null,
            settings: params.settings ?? {},
            current_total_uses: 0,
          })
          .returning();
        if (imageRef) {
          await storageObjectService.attach(
            {
              ref: imageRef,
              purpose: COUPON_IMAGE_PURPOSE,
              actorUserId: null,
              record: { type: "coupon", id: String(row.id), field: "image_url" },
            },
            executor,
          );
        }
        return row;
      });

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
