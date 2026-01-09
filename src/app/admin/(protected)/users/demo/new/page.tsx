// src/app/admin/(protected)/users/demo/new/page.tsx

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import DemoUserCreate from "@/features/core/user/components/admin/DemoUserCreate";

export const metadata = {
  title: "デモユーザー作成",
};

const LIST_PATH = "/admin/users/demo";

export default function AdminDemoUserCreatePage() {
  return (
    <AdminPage>
      <PageTitle>デモユーザー作成</PageTitle>
      <DemoUserCreate redirectPath={LIST_PATH} />
    </AdminPage>
  );
}
