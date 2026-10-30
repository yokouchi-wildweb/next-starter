// src/app/(user)/demo/block-appearance/_screen/loader.ts
// /demo/block-appearance(デモ)の loader。範囲 root(public。feature-gate の demo.samplePages で既定 404) の createLoader で access だけを評価する。
// サーバー側の取得は無い(データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/guard";

export const loadDemoBlockAppearanceScreen = createLoader({
  access: "public",
  load: async (): Promise<void> => {},
});
