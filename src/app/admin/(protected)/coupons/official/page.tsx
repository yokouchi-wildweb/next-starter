export const dynamic = "force-dynamic";

import { couponService } from "@/features/core/coupon/services/server/couponService";

import { settingService } from "@/features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/lib/crud";
import AdminCouponList from "@/features/core/coupon/components/AdminCouponList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "クーポン一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminCouponListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: coupons, total } = await couponService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <PageTitle>クーポン管理</PageTitle>
      <AdminCouponList coupons={coupons} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
