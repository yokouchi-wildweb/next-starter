// src/domains/core/messaging/layouts/link/email.tsx
// レイアウト「認証のリンク」のメールの描き方(server の一覧 layoutEmails)。見た目は ./LinkEmail(1 行スイッチ)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { LinkEmail } from "./LinkEmail";

export const emailRenderer: MessageLayoutEmailRenderer = {
  layout: "link",
  Component: LinkEmail as MessageLayoutEmailRenderer["Component"],
};
