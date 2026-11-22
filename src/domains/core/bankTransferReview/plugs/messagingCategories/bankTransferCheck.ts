// src/domains/core/bankTransferReview/plugs/messagingCategories/bankTransferCheck.ts
// 上流のカテゴリー: お振込の確認(種別 transactional = 本人のお支払いの手続きの知らせ、利用者は止めない)。
// bankTransferReview.transferCheck(振込審査の一覧から管理者が送る確認の連絡、D194)。この連絡のために決めた(D165)。
// 管理の 3 カテゴリー(メールは既定で切、D170)には載せず、メールもお知らせも最初から入れる

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "bankTransferCheck",
  label: "お振込の確認",
  description: "お振込の確認についての運営からのご連絡",
  kind: "transactional",
  channels: ["email", "inApp"],
};
