// src/app/(user)/demo/sortable-list/page.tsx

export const dynamic = "force-dynamic";

import { sampleService } from "@/features/sample/services/server/sampleService";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { SampleSortableList } from "./_components/SampleSortableList";

export const metadata = {
  title: "SortableList デモ",
};

export default async function SortableListDemoPage() {
  // searchForSorting: sort_order が NULL のレコードを自動初期化してから検索
  const { results: samples } = await sampleService.searchForSorting({
    page: 1,
    limit: 20,
    orderBy: [["sort_order", "ASC", "LAST"]],
  });

  return (
    <UserPage>
      <UserPageTitle>SortableList デモ</UserPageTitle>
      <SampleSortableList initialSamples={samples} />
    </UserPage>
  );
}
