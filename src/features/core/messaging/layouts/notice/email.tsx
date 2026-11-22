// src/features/core/messaging/layouts/notice/email.tsx
// レイアウト「汎用のお知らせ」のメールの描き方(server の一覧 layoutEmails)。見た目は ./NoticeEmail(1 行スイッチ)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { NoticeEmail } from "./NoticeEmail";

export const emailRenderer: MessageLayoutEmailRenderer = {
  layout: "notice",
  Component: NoticeEmail as MessageLayoutEmailRenderer["Component"],
};
