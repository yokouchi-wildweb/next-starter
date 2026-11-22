// src/domains/core/bankTransferReview/adminBulkActions/sendEmail.tsx
// 振込レビューの管理一覧: 選んだレビューの申告者へ連絡定義を送る。上流の既定の項目(D86)。
// 作成関数 definitionBulkAction(messaging)で定義連絡の汎用の送るモーダルを記録の入口で置く(D194)。
// 送る連絡定義は記録の宛先 recordTargets/reviews.ts(鍵 bankTransferReview.reviews)の messages(お振込の確認のご連絡 transferCheck)から選ぶ。
// レビュー → 申告者の解決と、送った後の管理メモの追記(メールを使った時だけ、D196)はその記録の宛先が持つ(D42・D190)。
// 外したい fork は sendEmail.override.ts で enabled: false にする

"use client";

import { definitionBulkAction } from "@/domains/core/messaging/components/DefinitionBulkAction";
import type { BankTransferReviewAdminBulkActionItem } from "@/domains/core/bankTransferReview/types/adminBulkAction";

export const bulkAction: BankTransferReviewAdminBulkActionItem = definitionBulkAction(
  { key: "sendEmail", order: 100 },
  { recordTarget: "bankTransferReview.reviews", label: "確認の連絡を送る" },
);
