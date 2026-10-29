// src/app/(user)/demo/async-picker-modal/page.tsx

import { UserPage } from "@/app/(user)/_layout/UserPage";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { Para } from "@/components/TextBlocks";

import { SamplePickerDemo } from "./_screen/SamplePickerDemo";

export const metadata = {
  title: "AsyncPickerModal デモ",
};

export default function AsyncPickerModalDemoPage() {
  return (
    <UserPage>
      <UserPageTitle>AsyncPickerModal デモ</UserPageTitle>
      <Para size="sm" tone="muted">
        サンプルマスタ（/api/sample）から検索してリストに追加する。追加済みの行は選択不可で「（追加済み）」が付く。
        AsyncMultiSelectInput（Popover 版）と同じ取得エンジンを使っている。
      </Para>
      <SamplePickerDemo />
    </UserPage>
  );
}
