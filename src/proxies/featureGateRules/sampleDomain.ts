// src/proxies/featureGateRules/sampleDomain.ts
// サンプルのドメイン(管理画面と汎用 CRUD)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/samples",
    "/admin/sample-categories",
    "/admin/sample-tags",
    "/api/sample",
    "/api/sampleCategory",
    "/api/sampleTag",
    "/api/sampleImage",
  ],
  enabled: () => APP_FEATURES.adminConsole.enableSampleDomain,
};
