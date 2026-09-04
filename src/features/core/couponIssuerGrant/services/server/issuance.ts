// src/features/core/couponIssuerGrant/services/server/issuance.ts
//
// 承認済み発行権に基づくクーポン発行（周期ポリシー付き）と、当期クーポンの参照・同期。
//
// 保証:
//  - fail-closed: program 未設定 → 503、grant が approved 以外 → 403
//  - 1 周期 1 枚: ユーザー単位の advisory lock + 周期内既存チェック。既存があればそれを返す（冪等）
//  - 発行されるクーポンは type=affiliate / category=program.category / attribution=本人 /
//    valid_from=周期開始 / valid_until=周期終了−1ms。code は coupon 側が自動生成

import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { runWithTransaction, type TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";
import { CouponTable } from "@/features/core/coupon/entities/drizzle";
import type { Coupon } from "@/features/core/coupon/entities/model";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import type { CouponIssuerGrant } from "@/features/core/couponIssuerGrant/entities/model";
import type { IssuancePeriod } from "@/features/core/couponIssuerGrant/types/program";
import { resolveIssuancePeriod } from "@/features/core/couponIssuerGrant/utils/period";
import { getGrantByUser } from "./queries";
import { getCouponIssuerProgram, requireCouponIssuerProgram } from "./program";

export type IssueForGrantResult = {
  coupon: Coupon;
  /** true = 今回新規発行、false = 当期の既存クーポンを返した */
  created: boolean;
  period: IssuancePeriod | null;
};

/**
 * 当期に発行済みのプログラムクーポンを取得（inactive 含む、削除済み除外）。
 * period=null（周期なし）の場合は「このカテゴリの本人クーポン」を対象にする。
 */
async function findProgramCoupon(
  executor: TransactionClient | typeof db,
  userId: string,
  category: string,
  period: IssuancePeriod | null,
): Promise<Coupon | null> {
  const conditions = [
    eq(CouponTable.attribution_user_id, userId),
    eq(CouponTable.type, "affiliate"),
    eq(CouponTable.category, category),
    isNull(CouponTable.deletedAt),
  ];
  if (period) {
    conditions.push(gte(CouponTable.valid_from, period.start), lt(CouponTable.valid_from, period.end));
  }
  const [row] = await executor
    .select()
    .from(CouponTable)
    .where(and(...conditions))
    .orderBy(sql`${CouponTable.createdAt} DESC`)
    .limit(1);
  return (row as Coupon | undefined) ?? null;
}

/** 本人の当期クーポンを取得（未発行 / 期間外 / program 未設定なら null） */
export async function getCurrentPeriodCoupon(
  userId: string,
  options?: { now?: Date },
  tx?: TransactionClient,
): Promise<{ coupon: Coupon | null; period: IssuancePeriod | null }> {
  const program = getCouponIssuerProgram();
  if (!program) return { coupon: null, period: null };
  const period = resolveIssuancePeriod(program.period, options?.now);
  if (program.period.kind === "custom" && !period) return { coupon: null, period: null };
  const coupon = await findProgramCoupon(tx ?? db, userId, program.category, period);
  return { coupon, period };
}

/**
 * 承認済み発行権に基づいてクーポンを発行する（本人）。
 * 当期に発行済みならそれを返す（冪等）。
 */
export async function issueForGrant(
  params: { userId: string; now?: Date },
  tx?: TransactionClient,
): Promise<IssueForGrantResult> {
  const program = requireCouponIssuerProgram();

  return runWithTransaction(tx, async (trx) => {
    // 同一ユーザーの同時発行を直列化（周期内 1 枚の TOCTOU を閉じる）
    await trx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`coupon_issuer:${params.userId}`}))`);

    const grant = await getGrantByUser(params.userId, trx, { lock: true });
    if (!grant || grant.status !== "approved") {
      throw new DomainError("クーポンを発行する権限がありません", { status: 403 });
    }

    const period = resolveIssuancePeriod(program.period, params.now);
    if (program.period.kind === "custom" && !period) {
      throw new DomainError("現在は発行期間外です", { status: 409 });
    }

    const existing = await findProgramCoupon(trx, params.userId, program.category, period);
    if (existing) {
      return { coupon: existing, created: false, period };
    }

    const issueParams = program.buildIssueParams({ grant, period });
    const coupon = await couponService.issueCodeForOwner(
      {
        attributionUserId: params.userId,
        type: "affiliate",
        category: program.category,
        name: issueParams.name,
        description: issueParams.description,
        imageUrl: issueParams.imageUrl,
        adminLabel: issueParams.adminLabel ?? `issuer-program:${period?.key ?? "none"}`,
        maxTotalUses: issueParams.maxTotalUses ?? null,
        maxUsesPerRedeemer: issueParams.maxUsesPerRedeemer ?? null,
        validFrom: period?.start ?? null,
        validUntil: period ? new Date(period.end.getTime() - 1) : null,
        settings: issueParams.settings ?? {},
      },
      trx,
    );

    return { coupon, created: true, period };
  });
}

/**
 * settings 変更を当期クーポンへ反映する（program.buildCouponPatch 定義時のみ）。
 * 反映したクーポンを返す。対象なし / パッチなしなら null。
 */
export async function syncCurrentPeriodCoupon(
  grant: CouponIssuerGrant,
  tx?: TransactionClient,
): Promise<Coupon | null> {
  const program = getCouponIssuerProgram();
  const buildCouponPatch = program?.buildCouponPatch;
  if (!program || !buildCouponPatch) return null;

  return runWithTransaction(tx, async (trx) => {
    const period = resolveIssuancePeriod(program.period);
    if (program.period.kind === "custom" && !period) return null;
    const coupon = await findProgramCoupon(trx, grant.user_id, program.category, period);
    if (!coupon) return null;

    const patch = buildCouponPatch({ grant, coupon, period });
    if (!patch) return null;

    const [updated] = await trx
      .update(CouponTable)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.maxTotalUses !== undefined ? { max_total_uses: patch.maxTotalUses } : {}),
        ...(patch.maxUsesPerRedeemer !== undefined ? { max_uses_per_redeemer: patch.maxUsesPerRedeemer } : {}),
        ...(patch.settings !== undefined ? { settings: patch.settings } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(CouponTable.id, coupon.id))
      .returning();
    return updated as Coupon;
  });
}

/** 停止 / 復帰に伴う当期クーポンの status 切替（対象なしなら何もしない） */
export async function setCurrentPeriodCouponStatus(
  grant: CouponIssuerGrant,
  status: "active" | "inactive",
  tx?: TransactionClient,
): Promise<Coupon | null> {
  const program = getCouponIssuerProgram();
  if (!program) return null;

  return runWithTransaction(tx, async (trx) => {
    const period = resolveIssuancePeriod(program.period);
    if (program.period.kind === "custom" && !period) return null;
    const coupon = await findProgramCoupon(trx, grant.user_id, program.category, period);
    if (!coupon || coupon.status === status) return coupon;

    const [updated] = await trx
      .update(CouponTable)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(CouponTable.id, coupon.id))
      .returning();
    return updated as Coupon;
  });
}
