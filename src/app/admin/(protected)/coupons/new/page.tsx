export const dynamic = "force-dynamic";


import AdminCouponCreate from "@/features/core/coupon/components/AdminCouponCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "クーポン追加",
};

export default function AdminCouponCreatePage() {

  return (

    <AdminPage>
      <PageTitle>クーポン追加</PageTitle>
      <AdminCouponCreate redirectPath="/admin/coupons" />
    </AdminPage>

  );
}
