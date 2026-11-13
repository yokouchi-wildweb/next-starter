// src/features/core/bankTransferReview/adminBulkActions/sendEmail.tsx
// 振込レビューの管理一覧: 選んだレビューの申告者へ連絡を一括で送る。上流の既定の項目(D86)。
// 作成関数 bulkMessageAction(messaging)の上に置く。レビュー → 申告者の解決と、送った後の管理メモの追記は
// サーバーの受け口の項目 messaging/bulkSendTargets/bankTransferReview.ts が持つ(連絡の議会 D42)。
// 振込の確認の連絡は運営から個別の連絡なので既定のカテゴリーは operatorDirect(種別 direct、受け取りの設定で止めない。画面で変えられる)。
// 外したい fork は sendEmail.override.ts で enabled: false にする

"use client";

import { bulkMessageAction } from "@/features/core/messaging/components/AdminBulkSend";
import type { BankTransferReviewAdminBulkActionItem } from "@/features/core/bankTransferReview/types/adminBulkAction";

const DEFAULT_IN_APP_BODY = `お振込のご確認に関する重要なお知らせをメールにて送付しております。
お手数をおかけいたしますが、ご確認のほどお願いいたします。`;

export const bulkAction: BankTransferReviewAdminBulkActionItem = bulkMessageAction(
  { key: "sendEmail", order: 100 },
  {
    target: "bankTransferReview",
    recordNoun: "振込レビュー",
    label: "メール一斉送信",
    defaultCategory: "operatorDirect",
    defaults: { inAppTitle: "お振込に関するお知らせ", inAppBody: DEFAULT_IN_APP_BODY },
  },
);
