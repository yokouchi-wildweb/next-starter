// src/app/(user)/demo/popover/_screen/DemoPopoverScreen.tsx
// /demo/popover(デモ)の既定画面。本体は client の DemoPopoverDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoPopoverDemo } from "./DemoPopoverDemo";
import { loadDemoPopoverScreen } from "./loader";

export async function DemoPopoverScreen(props: ScreenProps) {
  await loadDemoPopoverScreen(props);

  return <DemoPopoverDemo />;
}
