// src/app/(user)/demo/status-badge/_screen/loader.ts
// /demo/status-badge(デモ)の loader。範囲 root(public。feature-gate の demo.samplePages で既定 404) の createLoader で access だけを評価する。
// サーバー側の取得は無い(データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/guard";

export const loadDemoStatusBadgeScreen = createLoader({
  access: "public",
  load: async (): Promise<void> => {},
});
