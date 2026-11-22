// src/domains/core/messaging/layouts/link/inApp.tsx
// レイアウト「認証のリンク」のお知らせの描き方(client の一覧 layoutInApps)。見た目は ./LinkInApp(1 行スイッチ)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { LinkInApp } from "./LinkInApp";

export const inAppRenderer: MessageLayoutInAppRenderer = {
  layout: "link",
  Component: LinkInApp as MessageLayoutInAppRenderer["Component"],
};
