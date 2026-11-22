// src/domains/core/messaging/plugs/messagingLayouts/simple/email.tsx
// レイアウト「シンプル」のメールの描き方(server の一覧 layoutEmails)。見た目は ./SimpleEmail(1 行スイッチ)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { SimpleEmail } from "./SimpleEmail";

export const emailRenderer: MessageLayoutEmailRenderer = {
  layout: "simple",
  Component: SimpleEmail as MessageLayoutEmailRenderer["Component"],
};
