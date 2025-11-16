// src/app/admin/users/managerial/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { userService } from "@/features/user/services/server/userService";
import ManagerialUserEdit from "@/features/user/components/admin/ManagerialUserEdit";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";
import type { User } from "@/features/user/entities";

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
    <Main containerType="plain" className="p-6 space-y-6">
      <AdminPageTitle>システム管理者編集</AdminPageTitle>
      <ManagerialUserEdit user={user} redirectPath={REDIRECT_PATH} />
    </Main>
  );
}
