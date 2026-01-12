// src/app/admin/users/system/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { userService } from "@/features/core/user/services/server/userService";
import { getRoleCategory } from "@/features/core/user/constants";
import ManagerialUserEdit from "@/features/core/user/components/admin/ManagerialUserEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { User } from "@/features/core/user/entities";

export const metadata = {
  title: "システム管理者編集",
};

const REDIRECT_PATH = "/admin/users/system";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSystemUserEditPage({ params }: Props) {
  const { id } = await params;
  const user = (await userService.get(id)) as User;

  // user系カテゴリのロールの場合は general にリダイレクト
  if (getRoleCategory(user.role) === "user") {
    redirect(`/admin/users/general/${id}/edit`);
  }

  return (
    <AdminPage>
      <PageTitle>システム管理者編集</PageTitle>
      <ManagerialUserEdit user={user} redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
