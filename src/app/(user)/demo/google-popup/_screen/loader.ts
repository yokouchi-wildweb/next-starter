// src/app/(user)/demo/google-popup/_screen/loader.ts
// /demo/google-popup(デモ)の loader。範囲 root(public。門番の規則 demoPages で既定 404) の createLoader で access だけを評価する。
// サーバー側の取得は無い(データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/guard";

export const loadDemoGooglePopupScreen = createLoader({
  access: "public",
  load: async (): Promise<void> => {},
});
