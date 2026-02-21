export const dynamic = "force-dynamic";


import { couponService } from "@/features/core/coupon/services/server/couponService";
import AdminCouponEdit from "@/features/core/coupon/components/AdminCouponEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { Coupon } from "@/features/core/coupon/entities";

export const metadata = {
  title: "クーポン編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCouponEditPage({ params }: Props) {
  const { id } = await params;
  const coupon = (await couponService.get(id)) as Coupon;


  return (

    <AdminPage>
      <PageTitle>クーポン編集</PageTitle>
      <AdminCouponEdit coupon={coupon as Coupon} redirectPath="/admin/coupons/official" />
    </AdminPage>

  );
}
