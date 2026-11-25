// src/app/(user)/demo/sortable-list/_screen/DemoSortableListScreen.tsx
// /demo/sortable-list(デモ)の既定画面。

import { UserPage } from "@/app/(user)/_layout/UserPage";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { createScreen } from "@/wiring/screen";

import { loadDemoSortableListScreen } from "./loader";
import { SampleSortableList } from "./SampleSortableList";

export const { Screen: DemoSortableListScreen, generateMetadata } = createScreen({
  load: loadDemoSortableListScreen,
  render: ({ samples }) => (
    <UserPage>
      <UserPageTitle>SortableList デモ</UserPageTitle>
      <SampleSortableList initialSamples={samples} />
    </UserPage>
  ),
  metadata: {
    title: "SortableList デモ",
  },
});
