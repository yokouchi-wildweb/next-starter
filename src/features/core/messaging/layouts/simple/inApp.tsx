// src/features/core/messaging/layouts/simple/inApp.tsx
// レイアウト「シンプルなお知らせ」のお知らせの描き方(client の一覧 layoutInApps)。見た目は ./SimpleInApp(1 行スイッチ)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { SimpleInApp } from "./SimpleInApp";

export const inAppRenderer: MessageLayoutInAppRenderer = {
  layout: "simple",
  Component: SimpleInApp as MessageLayoutInAppRenderer["Component"],
};
