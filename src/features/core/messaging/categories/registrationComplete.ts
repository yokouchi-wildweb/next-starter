// src/features/core/messaging/categories/registrationComplete.ts
// 上流の種類: 会員登録の完了(種別 transactional)。user.registrationComplete・user.earlyRegistrationComplete

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "registrationComplete",
  label: "会員登録の完了",
  description: "会員登録が完了した時のお知らせ",
  kind: "transactional",
  channels: ["email"],
};
