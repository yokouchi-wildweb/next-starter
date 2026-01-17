import { ActivityIcon, LayoutDashboardIcon, Settings2Icon } from "lucide-react";

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { SolidTabs, UnderlineTabs, type PageTabItem } from "@/components/Navigation/PageTab";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Para } from "@/components/TextBlocks/Para";

export const metadata = {
  title: "タブUIデモ - インサイト",
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

export default function AdminTabsDemoInsightsPage() {
  return (
    <AdminPage>
      <PageTitle>タブUIデモ</PageTitle>
      <Section>
        <Stack space={6}>
          <SecTitle>タブ切り替えデモ（インサイト）</SecTitle>
          <Para tone="muted">
            タブを用いた複数ページ遷移の中で、インサイト表示や分析ビューのようなコンテンツを想定したレイアウト例です。
          </Para>
          <SolidTabs tabs={ADMIN_TABS_DEMO_ITEMS} ariaLabel="タブUIデモ" />
          <UnderlineTabs tabs={ADMIN_TABS_DEMO_ITEMS} ariaLabel="タブUIデモ（下線型）" />
          <Stack appearance="surface" padding="lg" space={4}>
            <Para>
              ここではダッシュボードやメトリクスの概要など、メイン領域で集約したい情報を掲示するケースを想定しています。タブを切り替えることでページごとに関心の異なる利用者に対応できます。
            </Para>
            <Para>
              データ取得やチャート描画などの実装は各ページに委譲されているため、タブ自体はレイアウトやアクセシビリティを統一する役割だけに集中しています。
            </Para>
          </Stack>
        </Stack>
      </Section>
    </AdminPage>
  );
}
