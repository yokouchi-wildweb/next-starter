// src/features/core/messaging/layouts/statement/inApp.tsx
// ひな形「お知らせの明細」のお知らせの描き方(client の一覧 layoutInApps)。見た目は ./StatementInApp(1 行スイッチ)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { StatementInApp } from "./StatementInApp";

export const inAppRenderer: MessageLayoutInAppRenderer = {
  layout: "statement",
  Component: StatementInApp as MessageLayoutInAppRenderer["Component"],
};
