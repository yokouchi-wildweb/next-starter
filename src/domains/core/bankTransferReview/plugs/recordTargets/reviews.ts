// src/domains/core/bankTransferReview/plugs/recordTargets/reviews.ts
//
// 記録の宛先(recordTargets、D190): 振込審査の一覧で選んだ審査 → 申告した利用者(1 人 1 件、その人の審査の id をまとめる)。
// 送れる連絡定義: お振込の確認のご連絡(plugs/messages/transferCheck.ts、D194)。記録から埋める値 = 宛名・金額・申告日
// (まとめた審査の分を「、」でつなぐ)。
// 送った後に選んだ審査の管理メモへ「YYYY/MM/DD「件名」メール送付」を 1 行足す(定義の送信でメールを送ったときだけ、D196)。
// このドメインが閉じていれば門番が落とす。決済(payment)が閉じていても使えない(enabled)

import { asc, eq, inArray } from "drizzle-orm";

import { gate } from "@/featureGate";
import { PurchaseRequestTable } from "@/domains/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { formatDateJa } from "@/utils/date";

import { BankTransferReviewTable } from "@/domains/core/bankTransferReview/entities/drizzle";
import { formatJpyAmount } from "@/domains/core/bankTransferReview/presenters";

import type { MessageRecordRecipient, MessageRecordTarget } from "@/lib/messaging";

/** 審査の行(申告の古い順)→ 1 人 1 件。値は連絡定義 transferCheck の recordVars(宛名・金額・申告日、まとめた分を「、」でつなぐ) */
export function recipientsOfRows(
  rows: readonly { id: string; userId: string; submittedAt: Date; paymentAmount: number | null; userName: string | null }[],
): MessageRecordRecipient[] {
  const byUser = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  return [...byUser].map(([userId, own]) => ({
    userId,
    recordIds: own.map((row) => row.id),
    vars: {
      displayName: own[0]!.userName || "お客様",
      paymentAmounts: own.map((row) => (row.paymentAmount === null ? "-" : formatJpyAmount(row.paymentAmount))).join("、"),
      submittedDates: own.map((row) => formatDateJa(row.submittedAt, { format: "YYYY/MM/DD" }) ?? "-").join("、"),
    },
  }));
}

export const recordTarget: MessageRecordTarget = {
  key: "bankTransferReview.reviews",
  label: "振込審査",
  // 送れる連絡定義(管理の定義の送る口の記録の入口。fork は隣の reviews.override.ts で並びを差し替えられる)
  messages: ["bankTransferReview.transferCheck"],
  // 振込審査の表は決済(payment)の地区。画面の機能 bankTransferReview(payment に dependsOn)も開いていること
  enabled: () => gate.enabled("payment") && gate.enabled("bankTransferReview"),
  async resolveRecipients(recordIds) {
    if (recordIds.length === 0) return [];
    const rows = await db
      .select({
        id: BankTransferReviewTable.id,
        userId: BankTransferReviewTable.user_id,
        submittedAt: BankTransferReviewTable.submitted_at,
        paymentAmount: PurchaseRequestTable.payment_amount,
        userName: UserTable.name,
      })
      .from(BankTransferReviewTable)
      .leftJoin(PurchaseRequestTable, eq(PurchaseRequestTable.id, BankTransferReviewTable.purchase_request_id))
      .leftJoin(UserTable, eq(UserTable.id, BankTransferReviewTable.user_id))
      .where(inArray(BankTransferReviewTable.id, [...recordIds]))
      .orderBy(asc(BankTransferReviewTable.submitted_at));
    return recipientsOfRows(rows);
  },
  async afterSend({ recordIds, channels, fields }) {
    // メールを送った時だけ(D196)。件名 = 送った欄の subject(テキストの編集の後、差し込む前の字)
    if (!channels.includes("email")) return;
    const subject = typeof fields.subject === "string" && fields.subject !== "" ? fields.subject : undefined;
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
