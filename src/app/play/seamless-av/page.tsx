// src/app/play/seamless-av/page.tsx
//
// 公開再生ページ(認証不要)。固定キーの最新マニフェストを SSR で読み、各端末で連結再生する。

import { getLatestManifest } from "@/lib/seamlessVideo/server/reelManifestStore";

import { SeamlessAvPlayer } from "./_components/SeamlessAvPlayer";

// 常に最新の保存内容を読むためキャッシュしない
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seamless A/V 再生",
};

export default async function PlaySeamlessAvPage() {
  const manifest = await getLatestManifest();
  return <SeamlessAvPlayer manifest={manifest} />;
}
