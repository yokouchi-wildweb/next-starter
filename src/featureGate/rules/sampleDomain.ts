// src/featureGate/rules/sampleDomain.ts
// サンプルのドメイン(管理画面と汎用 CRUD、5 表。サンプルを読むデモ画面は demoSampleDomain.ts)
// 入切の既定は開(上流のデモ用、権限は厳しくしていない)。実際の利用者がいる fork は src/config/featureGate/switches.config.ts で sampleDomain: false(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/samples",
    "/admin/sample-categories",
    "/admin/sample-tags",
    // サンプルを読むデモ画面は demoSampleDomain.ts(デモ × サンプル、サンプルを切ったら一緒に閉じる)
  ],
  domains: [
    "sample",
    "sampleCategory",
    "sampleTag",
    "sampleImage",
  ],
  defaultEnabled: false,
};
