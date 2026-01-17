import { ActivityIcon, LayoutDashboardIcon, Settings2Icon } from "lucide-react";

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { SolidTabs, UnderlineTabs, type PageTabItem } from "@/components/Navigation/PageTab";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Para } from "@/components/TextBlocks/Para";

export const metadata = {
  title: "タブUIデモ - 概要",
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

export default function AdminTabsDemoOverviewPage() {
  return (
    <AdminPage>
      <PageTitle>タブUIデモ</PageTitle>
      <Section space="md">
        <SecTitle>タブ切り替えデモ（概要）</SecTitle>
        <Para tone="muted">
          ナビゲーション専用のタブ部品を導入し、URL 遷移とタブUIを一貫して扱うためのデモページです。
        </Para>
        <SolidTabs tabs={ADMIN_TABS_DEMO_ITEMS} ariaLabel="タブUIデモ" />
        <UnderlineTabs tabs={ADMIN_TABS_DEMO_ITEMS} ariaLabel="タブUIデモ（下線型）" />
        <Stack appearance="surface" padding="lg" space={4}>
          <Para>
            このページではタブUIの概要を紹介しています。同じタブセットを各ページに設置しており、クリックと同時に対応するルートへ遷移します。
          </Para>
          <Para>
            体験としてはタブが切り替わっているように見えますが、実際には Next.js のルーティングが走ります。ルーティングに伴う状態管理や検証は各ページ側で責務を持ちます。
          </Para>
        </Stack>
      </Section>
    </AdminPage>
  );
}
