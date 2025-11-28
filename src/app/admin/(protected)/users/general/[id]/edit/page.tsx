// src/app/admin/users/general/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { userService } from "@/features/core/user/services/server/userService";
import GeneralUserEdit from "@/features/core/user/components/admin/GeneralUserEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { User } from "@/features/core/user/entities";

export const metadata = {
  title: "一般ユーザー編集",
};

const REDIRECT_PATH = "/admin/users/general";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminGeneralUserEditPage({ params }: Props) {
  const { id } = await params;
  const user = (await userService.get(id)) as User;

  if (user.role === "admin") {
    redirect(`/admin/users/managerial/${id}/edit`);
  }

  return (
    <AdminPage>
      <PageTitle>一般ユーザー編集</PageTitle>
      <GeneralUserEdit user={user} redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
