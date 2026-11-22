// src/features/core/messaging/layouts/statement/email.tsx
// レイアウト「明細」のメールの描き方(server の一覧 layoutEmails)。見た目は ./StatementEmail(1 行スイッチ)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { StatementEmail } from "./StatementEmail";

export const emailRenderer: MessageLayoutEmailRenderer = {
  layout: "statement",
  Component: StatementEmail as MessageLayoutEmailRenderer["Component"],
};
