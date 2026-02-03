import { ActivityIcon, LayoutDashboardIcon, Settings2Icon } from "lucide-react";

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { SolidTabs, UnderlineTabs, type PageTabItem } from "@/components/Navigation";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Para } from "@/components/TextBlocks/Para";

export const metadata = {
  title: "タブUIデモ - アクション",
};

const ADMIN_TABS_DEMO_ITEMS: PageTabItem[] = [
  {
    value: "overview",
    label: "概要",
    href: "/admin/tabs-demo/overview",
    icon: <LayoutDashboardIcon className="size-4" aria-hidden />,
  },
  {
    value: "insights",
    label: "インサイト",
    href: "/admin/tabs-demo/insights",
    icon: <ActivityIcon className="size-4" aria-hidden />,
  },
  {
    value: "actions",
    label: "アクション",
    href: "/admin/tabs-demo/actions",
    icon: <Settings2Icon className="size-4" aria-hidden />,
  },
];

export default function AdminTabsDemoActionsPage() {
  return (
    <AdminPage>
      <PageTitle>タブUIデモ</PageTitle>
      <Section>
        <Stack space={6}>
          <SecTitle>タブ切り替えデモ（アクション）</SecTitle>
          <Para tone="muted">
            フォーム送信や個別オペレーションを想定したページの例です。タブの切り替え位置は共通化し、ページ毎の操作を明確に分離します。
          </Para>
          <SolidTabs tabs={ADMIN_TABS_DEMO_ITEMS} ariaLabel="タブUIデモ" />
          <UnderlineTabs tabs={ADMIN_TABS_DEMO_ITEMS} ariaLabel="タブUIデモ（下線型）" />
          <Stack appearance="surface" padding="lg" space={4}>
            <Para>
              実際には複雑なフォームやテーブル操作を配置できますが、タブコンポーネント自体はナビゲーションだけに集中させています。ページ側で状態管理や離脱ガードを持つことで責務を分離できます。
            </Para>
            <Para>
              既存画面に導入する際もこのパターンを踏襲すれば、UI の統一感を保ちながら機能追加できます。
            </Para>
          </Stack>
        </Stack>
      </Section>
    </AdminPage>
  );
}
