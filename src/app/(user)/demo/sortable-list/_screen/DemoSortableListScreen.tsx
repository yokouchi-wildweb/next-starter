// src/app/(user)/demo/sortable-list/_screen/DemoSortableListScreen.tsx
// /demo/sortable-list(デモ)の既定画面。

import type { ScreenProps } from "@/lib/screens/types";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";

import { loadDemoSortableListScreen } from "./loader";
import { SampleSortableList } from "./SampleSortableList";

export const metadata = {
  title: "SortableList デモ",
};

export async function DemoSortableListScreen(props: ScreenProps) {
  const { samples } = await loadDemoSortableListScreen(props);

  return (
    <UserPage>
      <UserPageTitle>SortableList デモ</UserPageTitle>
      <SampleSortableList initialSamples={samples} />
    </UserPage>
  );
}
