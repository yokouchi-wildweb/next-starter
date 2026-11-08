// src/featureGate/rules/sampleDomain.ts
// サンプルのドメイン(管理画面と汎用 CRUD、サンプルを読むデモ画面、5 表)
// 門の値の持ち主 = sample(features の先頭、目録 D14)。値は src/features/sample/config.ts の enabled、fork は src/config/features/sample.config.ts

import { SAMPLE_CONFIG } from "@/features/sample/config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/samples",
    "/admin/sample-categories",
    "/admin/sample-tags",
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
  enabled: () => SAMPLE_CONFIG.enabled,
};
