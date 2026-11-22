// src/features/core/messaging/layouts/alert/email.tsx
// レイアウト「セキュリティの警告」のメールの描き方(server の一覧 layoutEmails)。見た目は ./AlertEmail(1 行スイッチ)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { AlertEmail } from "./AlertEmail";

export const emailRenderer: MessageLayoutEmailRenderer = {
  layout: "alert",
  Component: AlertEmail as MessageLayoutEmailRenderer["Component"],
};
