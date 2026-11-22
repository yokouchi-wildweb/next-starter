// src/features/core/bankTransferReview/adminBulkActions/sendEmail.tsx
// 振込レビューの管理一覧: 選んだレビューの申告者へ連絡を一括で送る。上流の既定の項目(D86)。
// 作成関数 bulkMessageAction(messaging)の上に置く。レビュー → 申告者の解決と、送った後の管理メモの追記は
// このドメインの記録の宛先 recordTargets/reviews.ts(鍵 bankTransferReview.reviews)が持つ(連絡の議会 D42・D190)。
// 決まった文面・カテゴリーは渡さない(それは連絡定義の物、D195 D200): 送るモーダルは種別から選び、初めのレイアウトの白紙から書く。
// 振込の確認の連絡を定義 + 汎用のモーダルで送る形への作り直しは後の指令(S5)。
// 外したい fork は sendEmail.override.ts で enabled: false にする

"use client";

import { bulkMessageAction } from "@/features/core/messaging/components/AdminBulkSend";
import type { BankTransferReviewAdminBulkActionItem } from "@/features/core/bankTransferReview/types/adminBulkAction";

export const bulkAction: BankTransferReviewAdminBulkActionItem = bulkMessageAction(
  { key: "sendEmail", order: 100 },
  {
    target: "bankTransferReview.reviews",
    recordNoun: "振込レビュー",
    label: "メール一斉送信",
  },
);
