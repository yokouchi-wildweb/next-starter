// src/features/core/messaging/bulkSendTargets/bankTransferReview.ts
//
// 管理の一括送信の対象: 振込審査の一覧(上流の最初の項目)。選んだ審査 → 申告した利用者、送った後に
// 選んだ審査の管理メモへ「YYYY/MM/DD「件名」メール送付」を 1 行足す(メールを送ったときだけ。前の一括メールと同じ)。
// 決済・振込審査の機能が閉じていれば使えない

import { eq, inArray } from "drizzle-orm";

import { gate } from "@/featureGate";
import { db } from "@/lib/drizzle";
import { formatDateJa } from "@/utils/date";

import { BankTransferReviewTable } from "@/features/core/bankTransferReview/entities/drizzle";

import type { MessageBulkSendTarget } from "../services/server/admin/types";

export const bulkSendTarget: MessageBulkSendTarget = {
  key: "bankTransferReview",
  label: "振込審査",
  // 振込審査の表は決済(payment)の地区。画面の機能 bankTransferReview(payment に dependsOn)も開いていること
  enabled: () => gate.enabled("payment") && gate.enabled("bankTransferReview"),
  async resolveUserIds(recordIds) {
    if (recordIds.length === 0) return [];
    const rows = await db
      .select({ userId: BankTransferReviewTable.user_id })
      .from(BankTransferReviewTable)
      .where(inArray(BankTransferReviewTable.id, [...recordIds]));
    return rows.map((row) => row.userId);
  },
  async afterSend({ recordIds, content }) {
    // 送った文面のメールの件名(差し込む前の字)
    const email = content.email as { subject?: unknown } | undefined;
    const subject = typeof email?.subject === "string" ? email.subject : undefined;
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
