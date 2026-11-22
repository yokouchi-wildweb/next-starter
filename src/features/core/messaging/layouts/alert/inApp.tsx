// src/features/core/messaging/layouts/alert/inApp.tsx
// レイアウト「セキュリティの警告」のお知らせの描き方(client の一覧 layoutInApps)。見た目は ./AlertInApp(1 行スイッチ)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { AlertInApp } from "./AlertInApp";

export const inAppRenderer: MessageLayoutInAppRenderer = {
  layout: "alert",
  Component: AlertInApp as MessageLayoutInAppRenderer["Component"],
};
