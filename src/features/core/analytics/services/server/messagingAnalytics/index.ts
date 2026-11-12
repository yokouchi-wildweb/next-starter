// src/features/core/analytics/services/server/messagingAnalytics/index.ts
// 連絡の集計の本物の部品(SQL の store・門・messaging の保持の日数)。中身: ./service.ts、SQL: ./store.ts

import { gate } from "@/featureGate";
import { messagingConfig } from "@/features/core/messaging/config";

import { createMessagingAnalytics } from "./service";
import { drizzleMessagingAnalyticsStore } from "./store";

const analytics = createMessagingAnalytics({
  store: drizzleMessagingAnalyticsStore,
  gateEnabled: (feature) => gate.enabled(feature),
  now: () => new Date(),
  deliveriesDays: messagingConfig.retention.deliveriesDays,
});

export const getMessagingSummary = analytics.getSummary;
export const getMessagingSeries = analytics.getSeries;
export const getMessagingBreakdown = analytics.getBreakdown;
export const getMessagingDispatches = analytics.getDispatches;

export { parseMessagingFilterParams } from "./params";
export { createMessagingAnalytics, decodeDispatchCursor, encodeDispatchCursor, type MessagingAnalytics } from "./service";
export type * from "./types";
export { MESSAGING_BREAKDOWN_AXES } from "./types";
