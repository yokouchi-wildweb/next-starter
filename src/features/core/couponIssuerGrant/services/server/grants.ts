// src/features/core/couponIssuerGrant/services/server/grants.ts
//
// 発行権の申請と審査（状態遷移）。
//
// 遷移:
//   (なし) --apply--> pending --approve--> approved --suspend--> suspended --reinstate--> approved
//                    pending --reject---> rejected --apply--> pending（再申請）
//
// 書き込みは base.create / base.update を通す（CRUD 自動監査で before/after が残る）。
// 当期クーポンへの反映（停止時の無効化・設定変更時のパッチ）は issuance.ts に委譲する。

import { runWithTransaction, type TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";
import type { CouponIssuerGrant } from "@/features/core/couponIssuerGrant/entities/model";
import { couponIssuerGrantBase } from "./drizzleBase";
import { getGrantByUser, requireGrantForUpdate as requireGrant } from "./queries";
import {
  setCurrentPeriodCouponStatus,
  syncCurrentPeriodCoupon,
} from "./issuance";

export type ApplyGrantParams = {
  userId: string;
  /** 申請フォームの内容（下流定義、任意） */
  application?: Record<string, unknown>;
};

/**
 * 発行権を申請する（本人）。
 * - 未申請 → pending で作成
 * - pending → 既存をそのまま返す（冪等）
 * - rejected → 再申請（pending に戻し requested_at を更新）
 * - approved / suspended → 409
 */
export async function applyGrant(
  params: ApplyGrantParams,
  tx?: TransactionClient,
): Promise<CouponIssuerGrant> {
  return runWithTransaction(tx, async (trx) => {
    const existing = await getGrantByUser(params.userId, trx, { lock: true });

    if (!existing) {
      return couponIssuerGrantBase.create(
        {
          user_id: params.userId,
          status: "pending",
          application: params.application ?? {},
        },
        trx,
      ) as Promise<CouponIssuerGrant>;
    }

    switch (existing.status) {
      case "pending":
        return existing;
      case "rejected":
        return couponIssuerGrantBase.update(
          existing.id,
          {
            status: "pending",
            application: params.application ?? existing.application,
            requested_at: new Date(),
            reviewed_at: null,
            reviewed_by: null,
          },
          trx,
        ) as Promise<CouponIssuerGrant>;
      case "approved":
        throw new DomainError("既に承認済みです", { status: 409 });
      case "suspended":
        throw new DomainError("発行権は停止中です。運営にお問い合わせください", { status: 409 });
    }
  });
}

export type ReviewGrantParams = {
  grantId: string;
  decision: "approve" | "reject";
  reviewedBy: string;
  /** approve 時の per-user 設定。省略なら既存 settings を維持 */
  settings?: Record<string, unknown>;
  adminNote?: string | null;
};

/** 申請を審査する（管理者）。pending からのみ遷移可 */
export async function reviewGrant(
  params: ReviewGrantParams,
  tx?: TransactionClient,
): Promise<CouponIssuerGrant> {
  return runWithTransaction(tx, async (trx) => {
    const grant = await requireGrant(params.grantId, trx);
    if (grant.status !== "pending") {
      throw new DomainError(`審査できる状態ではありません（現在: ${grant.status}）`, { status: 409 });
    }
    return couponIssuerGrantBase.update(
      grant.id,
      {
        status: params.decision === "approve" ? "approved" : "rejected",
        settings: params.settings ?? grant.settings,
        reviewed_at: new Date(),
        reviewed_by: params.reviewedBy,
        ...(params.adminNote !== undefined ? { admin_note: params.adminNote } : {}),
      },
      trx,
    ) as Promise<CouponIssuerGrant>;
  });
}

export type SuspendGrantParams = {
  grantId: string;
  reviewedBy: string;
  adminNote?: string | null;
};

/**
 * 承認済みの発行権を停止する（管理者）。
 * 当期の発行済みクーポンがあれば inactive にする（停止中の使用を止める）。
 */
export async function suspendGrant(
  params: SuspendGrantParams,
  tx?: TransactionClient,
): Promise<CouponIssuerGrant> {
  return runWithTransaction(tx, async (trx) => {
    const grant = await requireGrant(params.grantId, trx);
    if (grant.status !== "approved") {
      throw new DomainError(`停止できる状態ではありません（現在: ${grant.status}）`, { status: 409 });
    }
    const updated = (await couponIssuerGrantBase.update(
      grant.id,
      {
        status: "suspended",
        reviewed_at: new Date(),
        reviewed_by: params.reviewedBy,
        ...(params.adminNote !== undefined ? { admin_note: params.adminNote } : {}),
      },
      trx,
    )) as CouponIssuerGrant;
    await setCurrentPeriodCouponStatus(updated, "inactive", trx);
    return updated;
  });
}

export type ReinstateGrantParams = SuspendGrantParams;

/**
 * 停止中の発行権を復帰する（管理者）。
 * 当期の発行済みクーポンがあれば active に戻す（周期が変わっていれば何もしない）。
 */
export async function reinstateGrant(
  params: ReinstateGrantParams,
  tx?: TransactionClient,
): Promise<CouponIssuerGrant> {
  return runWithTransaction(tx, async (trx) => {
    const grant = await requireGrant(params.grantId, trx);
    if (grant.status !== "suspended") {
      throw new DomainError(`復帰できる状態ではありません（現在: ${grant.status}）`, { status: 409 });
    }
    const updated = (await couponIssuerGrantBase.update(
      grant.id,
      {
        status: "approved",
        reviewed_at: new Date(),
        reviewed_by: params.reviewedBy,
        ...(params.adminNote !== undefined ? { admin_note: params.adminNote } : {}),
      },
      trx,
    )) as CouponIssuerGrant;
    await setCurrentPeriodCouponStatus(updated, "active", trx);
    return updated;
  });
}

export type UpdateGrantSettingsParams = {
  grantId: string;
  /** 置換（マージしない）。フォームは全項目を送ること */
  settings: Record<string, unknown>;
  updatedBy: string;
  adminNote?: string | null;
};

/**
 * per-user 設定を更新する（管理者）。
 * approved かつ program.buildCouponPatch が定義されていれば、当期クーポンへ即時反映する。
 */
export async function updateGrantSettings(
  params: UpdateGrantSettingsParams,
  tx?: TransactionClient,
): Promise<{ grant: CouponIssuerGrant; syncedCouponId: string | null }> {
  return runWithTransaction(tx, async (trx) => {
    const grant = await requireGrant(params.grantId, trx);
    const updated = (await couponIssuerGrantBase.update(
      grant.id,
      {
        settings: params.settings,
        ...(params.adminNote !== undefined ? { admin_note: params.adminNote } : {}),
      },
      trx,
    )) as CouponIssuerGrant;

    const synced = updated.status === "approved" ? await syncCurrentPeriodCoupon(updated, trx) : null;
    return { grant: updated, syncedCouponId: synced?.id ?? null };
  });
}
