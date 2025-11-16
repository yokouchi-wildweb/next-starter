// src/app/admin/users/general/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { userService } from "@/features/user/services/server/userService";
import GeneralUserEdit from "@/features/user/components/admin/GeneralUserEdit";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";
import type { User } from "@/features/user/entities";

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
    <Main containerType="plain" className="p-6 space-y-6">
      <AdminPageTitle>一般ユーザー編集</AdminPageTitle>
      <GeneralUserEdit user={user} redirectPath={REDIRECT_PATH} />
    </Main>
  );
}
