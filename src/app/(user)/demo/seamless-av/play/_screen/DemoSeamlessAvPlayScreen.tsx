// src/app/(user)/demo/seamless-av/play/_screen/DemoSeamlessAvPlayScreen.tsx
// /demo/seamless-av/play(デモ)の既定画面。最新マニフェストを各端末で連結再生する。

import type { ScreenProps } from "@/lib/screens/types";

import { loadDemoSeamlessAvPlayScreen } from "./loader";
import { SeamlessAvPlayer } from "./SeamlessAvPlayer";

export const metadata = {
  title: "Seamless A/V 再生",
};

export async function DemoSeamlessAvPlayScreen(props: ScreenProps) {
  const { manifest } = await loadDemoSeamlessAvPlayScreen(props);
  return <SeamlessAvPlayer manifest={manifest} />;
}
