// src/app/admin/users/general/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { userService } from "@/features/core/user/services/server/userService";
import { getRoleCategory, type UserRoleType } from "@/features/core/user/constants";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
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

  // admin系カテゴリのロールの場合は system にリダイレクト
  if (getRoleCategory(user.role) === "admin") {
    redirect(`/admin/users/system/${id}/edit`);
  }

  // プロフィールデータを取得
  const profileData = await userProfileService.getProfile(id, user.role as UserRoleType);

  return (
    <AdminPage>
      <PageTitle>一般ユーザー編集</PageTitle>
      <GeneralUserEdit user={user} profileData={profileData ?? undefined} redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
