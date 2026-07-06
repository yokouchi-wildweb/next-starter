// src/features/core/userAcquisition/services/server/recordSignupAcquisition.ts

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import {
  UserAcquisitionTable,
  UserAcquisitionTouchTable,
} from "@/features/core/userAcquisition/entities/drizzle";
import type {
  AcquisitionExtras,
  AcquisitionTouch,
} from "@/features/core/userAcquisition/entities/model";

export type RecordSignupAcquisitionInput = {
  userId: string;
  /** cookie から復元したタッチ列（時系列昇順を想定。念のため内部で再ソートする） */
  touches: AcquisitionTouch[];
  /** 省略時は now */
  signupAt?: Date;
  /** サマリー行の extras に保存するロングテール情報（GA client_id 等） */
  extras?: AcquisitionExtras | null;
};

/**
 * サインアップ本登録時に流入タッチ履歴を確定保存する。
 * - user_acquisitions（1:1 サマリー）: first/last タッチを非正規化して upsert
 * - user_acquisition_touches（1:N 明細）: 全タッチを書き直し
 *
 * 再入会（withdrawn → active）では既存行が残っているため、
 * 新しい獲得ジャーニーとして上書きする（明細は delete & insert）。
 *
 * 設計上の取り決め:
 * - bestEffort: 解析用データのため、書き込み失敗は登録フローを阻害しない。
 *   失敗時は console.error にログ出力するのみ（userLoginEvent と同じ運用）。
 * - タッチが 0 件なら何もしない（オーガニック直訪のみのユーザーは行を持たない）。
 */
export async function recordSignupAcquisition(
  input: RecordSignupAcquisitionInput,
): Promise<void> {
  if (input.touches.length === 0) return;

  const touches = [...input.touches].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const first = touches[0];
  const last = touches[touches.length - 1];
  const signupAt = input.signupAt ?? new Date();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(UserAcquisitionTable)
        .values({
          userId: input.userId,
          firstUtmSource: first.utmSource,
          firstUtmMedium: first.utmMedium,
          firstUtmCampaign: first.utmCampaign,
          firstReferrerHost: first.referrerHost,
          firstLandingPage: first.landingPage,
          firstTouchAt: first.occurredAt,
          lastUtmSource: last.utmSource,
          lastUtmMedium: last.utmMedium,
          lastUtmCampaign: last.utmCampaign,
          lastReferrerHost: last.referrerHost,
          lastLandingPage: last.landingPage,
          lastTouchAt: last.occurredAt,
          touchCount: touches.length,
          signupAt,
          extras: input.extras ?? null,
        })
        .onConflictDoUpdate({
          target: UserAcquisitionTable.userId,
          set: {
            firstUtmSource: first.utmSource,
            firstUtmMedium: first.utmMedium,
            firstUtmCampaign: first.utmCampaign,
            firstReferrerHost: first.referrerHost,
            firstLandingPage: first.landingPage,
            firstTouchAt: first.occurredAt,
            lastUtmSource: last.utmSource,
            lastUtmMedium: last.utmMedium,
            lastUtmCampaign: last.utmCampaign,
            lastReferrerHost: last.referrerHost,
            lastLandingPage: last.landingPage,
            lastTouchAt: last.occurredAt,
            touchCount: touches.length,
            signupAt,
            extras: input.extras ?? null,
            updatedAt: now,
          },
        });

      await tx
        .delete(UserAcquisitionTouchTable)
        .where(eq(UserAcquisitionTouchTable.userId, input.userId));

      await tx.insert(UserAcquisitionTouchTable).values(
        touches.map((touch, index) => ({
          userId: input.userId,
          touchIndex: index,
          occurredAt: touch.occurredAt,
          utmSource: touch.utmSource,
          utmMedium: touch.utmMedium,
          utmCampaign: touch.utmCampaign,
          referrerHost: touch.referrerHost,
          landingPage: touch.landingPage,
          extras: touch.extras,
        })),
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: "error",
        scope: "user-acquisition",
        op: "recordSignupAcquisition",
        userId: input.userId,
        touchCount: touches.length,
        error: message,
      }),
    );
  }
}
