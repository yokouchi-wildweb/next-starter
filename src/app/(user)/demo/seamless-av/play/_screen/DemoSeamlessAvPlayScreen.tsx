// src/app/(user)/demo/seamless-av/play/_screen/DemoSeamlessAvPlayScreen.tsx
// /demo/seamless-av/play(デモ)の既定画面。最新マニフェストを各端末で連結再生する。


import { createScreen } from "@/wiring/screen";

import { loadDemoSeamlessAvPlayScreen } from "./loader";
import { SeamlessAvPlayer } from "./SeamlessAvPlayer";

export const { Screen: DemoSeamlessAvPlayScreen, generateMetadata } = createScreen({
  load: loadDemoSeamlessAvPlayScreen,
  render: ({ manifest }) => <SeamlessAvPlayer manifest={manifest} />,
  metadata: {
    title: "Seamless A/V 再生",
  },
});
