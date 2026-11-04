// src/lib/analyticsConsent/index.ts

export {
  type AnalyticsConsent,
  type AnalyticsGateConfig,
  decideAnalyticsAllowed,
  getAnalyticsConsent,
  isAnalyticsAllowed,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from "./consent";
export { useAnalyticsConsent } from "./useAnalyticsConsent";
