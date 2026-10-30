// src/app/(user)/demo/seamless-av/play/_screen/loader.ts
// /demo/seamless-av/play(公開再生ページ)の loader。範囲 root の createLoader(access public。feature-gate の demo.samplePages で既定 404)。
// 固定キーの最新マニフェストを読む(無ければ null)。

import "server-only";

import { getLatestManifest } from "@/lib/seamlessVideo/server/reelManifestStore";
import { createLoader } from "@/app/guard";

export const loadDemoSeamlessAvPlayScreen = createLoader({
  access: "public",
  load: async () => ({ manifest: await getLatestManifest() }),
});
