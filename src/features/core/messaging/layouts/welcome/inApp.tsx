// src/features/core/messaging/layouts/welcome/inApp.tsx
// レイアウト「ようこそ」のお知らせの描き方(client の一覧 layoutInApps)。見た目は ./WelcomeInApp(1 行スイッチ)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { WelcomeInApp } from "./WelcomeInApp";

export const inAppRenderer: MessageLayoutInAppRenderer = {
  layout: "welcome",
  Component: WelcomeInApp as MessageLayoutInAppRenderer["Component"],
};
