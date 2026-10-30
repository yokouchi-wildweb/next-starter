// src/app/(user)/demo/tables/_screen/DemoTablesScreen.tsx
// /demo/tables(デモ)の既定画面。本体は client の DemoTablesDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoTablesDemo } from "./DemoTablesDemo";
import { loadDemoTablesScreen } from "./loader";

export async function DemoTablesScreen(props: ScreenProps) {
  await loadDemoTablesScreen(props);

  return <DemoTablesDemo />;
}
