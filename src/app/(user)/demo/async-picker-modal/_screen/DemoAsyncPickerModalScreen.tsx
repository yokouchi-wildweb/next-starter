// src/app/(user)/demo/async-picker-modal/_screen/DemoAsyncPickerModalScreen.tsx
// /demo/async-picker-modal(デモ)の既定画面。

import { UserPage } from "@/app/(user)/_layout/UserPage";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { Para } from "@/components/TextBlocks/Para";
import { createScreen } from "@/wiring/screen";

import { SamplePickerDemo } from "./SamplePickerDemo";

import { loadDemoAsyncPickerModalScreen } from "./loader";

export const { Screen: DemoAsyncPickerModalScreen, generateMetadata } = createScreen({
  load: loadDemoAsyncPickerModalScreen,
  render: () => (
    <UserPage>
      <UserPageTitle>AsyncPickerModal デモ</UserPageTitle>
      <Para size="sm" tone="muted">
        サンプルマスタ（/api/sample）から検索してリストに追加する。追加済みの行は選択不可で「（追加済み）」が付く。
        AsyncMultiSelectInput（Popover 版）と同じ取得エンジンを使っている。
      </Para>
      <SamplePickerDemo />
    </UserPage>
  ),
  metadata: {
    title: "AsyncPickerModal デモ",
  },
});
