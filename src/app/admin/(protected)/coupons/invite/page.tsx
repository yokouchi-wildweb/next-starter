export const dynamic = "force-dynamic";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { referralService } from "@/features/core/referral/services/server/referralService";
import { settingService } from "@/features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/lib/crud";
import AdminInviteList from "@/features/core/referral/components/AdminInviteList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Para } from "@/components/TextBlocks/Para";

export const metadata = {
  title: "クーポン一覧（ユーザー招待）",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminCouponInviteListPage({ searchParams }: Props) {
  if (!APP_FEATURES.marketing.referral.enabled) {
    return (
      <AdminPage>
        <PageTitle>クーポン管理</PageTitle>
        <Para>ユーザーの紹介機能が無効です</Para>
      </AdminPage>
    );
  }

  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();

  const { items, total } = await referralService.getInviteCodeListWithCounts({
    page,
    limit,
    searchQuery,
  });

  return (
    <AdminPage>
      <PageTitle>クーポン管理</PageTitle>
      <AdminInviteList items={items} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
