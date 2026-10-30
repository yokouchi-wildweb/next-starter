// src/proxies/featureGateRules/sampleDomain.ts
// サンプルのドメイン(管理画面と汎用 CRUD、サンプルを読むデモ画面、5 表)

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
    // サンプルを読むデモ画面(デモのスイッチ demo.samplePages とは別に、サンプルを切ったら一緒に閉じる)
    "/demo/async-picker-modal",
    "/demo/popover",
    "/demo/sortable-list",
    "/demo/tables",
  ],
  features: [
    "sample",
    "sampleCategory",
    "sampleTag",
    "sampleImage",
  ],
  enabled: () => APP_FEATURES.adminConsole.enableSampleDomain,
};
