// src/app/(user)/demo/tables/_screen/DemoTablesScreen.tsx
// /demo/tables(デモ)の既定画面。本体は client の DemoTablesDemo。


import { createScreen } from "@/wiring/screen";

import { DemoTablesDemo } from "./DemoTablesDemo";
import { loadDemoTablesScreen } from "./loader";

export const { Screen: DemoTablesScreen, generateMetadata } = createScreen({
  load: loadDemoTablesScreen,
  render: () => <DemoTablesDemo />,
});
