// src/features/core/bankTransferReview/recordTargets/reviews.ts
//
// 記録の宛先(recordTargets、D190): 振込審査の一覧で選んだ審査 → 申告した利用者(1 人 1 件、その人の審査の id をまとめる)。
// 送った後に選んだ審査の管理メモへ「YYYY/MM/DD「件名」メール送付」を 1 行足す(メールを送ったときだけ。前の一括メールと同じ)。
// このドメインが閉じていれば門番が落とす。決済(payment)が閉じていても使えない(enabled)。中身の作り直しは S5

import { eq, inArray } from "drizzle-orm";

import { gate } from "@/featureGate";
import { db } from "@/lib/drizzle";
import { formatDateJa } from "@/utils/date";

import { BankTransferReviewTable } from "../entities/drizzle";

import type { MessageRecordTarget } from "@/lib/messaging";

export const recordTarget: MessageRecordTarget = {
  key: "bankTransferReview.reviews",
  label: "振込審査",
  // 振込審査の表は決済(payment)の地区。画面の機能 bankTransferReview(payment に dependsOn)も開いていること
  enabled: () => gate.enabled("payment") && gate.enabled("bankTransferReview"),
  async resolveRecipients(recordIds) {
    if (recordIds.length === 0) return [];
    const rows = await db
      .select({ id: BankTransferReviewTable.id, userId: BankTransferReviewTable.user_id })
      .from(BankTransferReviewTable)
      .where(inArray(BankTransferReviewTable.id, [...recordIds]));
    // 1 人 1 件(同じ人の審査はまとめる)。記録から埋める値はまだ無い(S5)
    const byUser = new Map<string, string[]>();
    for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.id]);
    return [...byUser].map(([userId, ids]) => ({ userId, vars: {}, recordIds: ids }));
  },
  async afterSend({ recordIds, values }) {
    // 送った中身の件名(汎用のお知らせの subject、差し込む前の字)
    const subject = typeof values.subject === "string" && values.subject !== "" ? values.subject : undefined;
    if (!subject || recordIds.length === 0) return;
    const today = formatDateJa(new Date(), { format: "YYYY/MM/DD" }) ?? "";
    const memoLine = `${today}「${subject}」メール送付`;
    // 件名に任意の文字が入るので SQL で連結せずアプリで組む。行を固めて読み足す
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: BankTransferReviewTable.id, adminMemo: BankTransferReviewTable.admin_memo })
        .from(BankTransferReviewTable)
        .where(inArray(BankTransferReviewTable.id, [...recordIds]))
        .for("update");
      const now = new Date();
      for (const row of rows) {
        await tx
          .update(BankTransferReviewTable)
          .set({ admin_memo: row.adminMemo ? `${row.adminMemo}\n${memoLine}` : memoLine, updatedAt: now })
          .where(eq(BankTransferReviewTable.id, row.id));
      }
    });
  },
};
