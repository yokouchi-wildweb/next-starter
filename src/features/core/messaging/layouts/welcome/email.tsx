// src/features/core/messaging/layouts/welcome/email.tsx
// ひな形「ようこそ」のメールの描き方(server の一覧 layoutEmails)。見た目は ./WelcomeEmail(1 行スイッチ)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { WelcomeEmail } from "./WelcomeEmail";

export const emailRenderer: MessageLayoutEmailRenderer = {
  layout: "welcome",
  Component: WelcomeEmail as MessageLayoutEmailRenderer["Component"],
};
