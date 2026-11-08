// src/features/core/bankTransferReview/adminBulkActions/sendEmail.tsx
// 振込レビューの管理一覧: 選んだレビューの申告者へメールを一斉送信する。上流の既定の項目(D86)。
// 中身(送り方 adminBulkSendBankTransferReviewEmail・既定の題と本文・送付履歴の管理者メモへの追記)は
// 今までの一覧の表の手書きのまま。送る仕組み・文面・記録の見直しは連絡の議会(20261108-120538)の結論で替わる。
// 外したい fork は sendEmail.override.ts で enabled: false にする

"use client";

import { BulkSendEmailButton } from "@/components/BulkSendEmail";
import {
  adminBulkSendBankTransferReviewEmail,
  type AdminBankTransferReviewListItem,
} from "@/features/core/bankTransferReview/services/client/bankTransferReviewClient";
import type { BankTransferReviewAdminBulkActionItem } from "@/features/core/bankTransferReview/types/adminBulkAction";
import type { BulkActionProps } from "@/lib/tableSuite";

const DEFAULT_NOTIFICATION_BODY = `お振込のご確認に関する重要なお知らせをメールにて送付しております。
お手数をおかけいたしますが、ご確認のほどお願いいたします。`;

function SendEmailBulkAction({ selection, onDone }: BulkActionProps<AdminBankTransferReviewListItem>) {
  return (
    <BulkSendEmailButton
      ids={selection.selectedIds}
      onSend={adminBulkSendBankTransferReviewEmail}
      recordNoun="振込レビュー"
      defaultNotificationTitle="お振込に関するお知らせ"
      defaultNotificationBody={DEFAULT_NOTIFICATION_BODY}
      subjectPlaceholder="例: お振込内容の確認のお願い"
      onSuccess={onDone}
    />
  );
}

export const bulkAction: BankTransferReviewAdminBulkActionItem = {
  key: "sendEmail",
  order: 100,
  Component: SendEmailBulkAction,
};
