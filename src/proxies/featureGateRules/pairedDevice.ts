// src/proxies/featureGateRules/pairedDevice.ts
// 登録端末(共有端末のペアリングと端末トークン認証)

import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/paired-device",
    "/api/paired-devices",
    "/api/cron/paired-device-pairings-prune",
  ],
  features: [
    "core/pairedDevice",
  ],
  enabled: () => PAIRED_DEVICE_CONFIG.enabled,
};
