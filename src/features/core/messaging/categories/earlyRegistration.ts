// src/features/core/messaging/categories/earlyRegistration.ts
// 上流の種類: 先行登録の確認(種別 functional)。auth.earlyRegistration

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "earlyRegistration",
  label: "先行登録の確認",
  description: "先行登録のメールアドレスの確認",
  kind: "functional",
  channels: ["email"],
};
