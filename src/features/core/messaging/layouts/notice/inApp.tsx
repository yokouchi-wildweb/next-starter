// src/features/core/messaging/layouts/notice/inApp.tsx
// ひな形「汎用のお知らせ」のお知らせの描き方(client の一覧 layoutInApps)。見た目は ./NoticeInApp(1 行スイッチ)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { NoticeInApp } from "./NoticeInApp";

export const inAppRenderer: MessageLayoutInAppRenderer = {
  layout: "notice",
  Component: NoticeInApp as MessageLayoutInAppRenderer["Component"],
};
