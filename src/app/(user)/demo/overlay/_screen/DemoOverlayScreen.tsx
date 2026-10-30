// src/app/(user)/demo/overlay/_screen/DemoOverlayScreen.tsx
// /demo/overlay(デモ)の既定画面。本体は client の DemoOverlayDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoOverlayDemo } from "./DemoOverlayDemo";
import { loadDemoOverlayScreen } from "./loader";

export async function DemoOverlayScreen(props: ScreenProps) {
  await loadDemoOverlayScreen(props);

  return <DemoOverlayDemo />;
}
