// src/app/admin/users/managerial/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { userService } from "@/features/core/user/services/server/userService";
import ManagerialUserEdit from "@/features/core/user/components/admin/ManagerialUserEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { User } from "@/features/core/user/entities";

export const metadata = {
  title: "システム管理者編集",
};

const REDIRECT_PATH = "/admin/users/managerial";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminManagerialUserEditPage({ params }: Props) {
  const { id } = await params;
  const user = (await userService.get(id)) as User;

  if (user.role === "user") {
    redirect(`/admin/users/general/${id}/edit`);
  }

  return (
    <AdminPage>
      <PageTitle>システム管理者編集</PageTitle>
      <ManagerialUserEdit user={user} redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
