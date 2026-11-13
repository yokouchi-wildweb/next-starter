// src/features/core/messaging/categories/operatorDirect.ts
// 上流の種類: 運営からのご連絡(種別 direct)。管理の送信の『取引』の選択(指令 37 で種別ごとの定義に替わるまでの仮)

import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "operatorDirect",
  label: "運営からのご連絡",
  description: "運営からあなたへの個別のご連絡",
  kind: "direct",
  channels: ["email", "inApp"],
};
