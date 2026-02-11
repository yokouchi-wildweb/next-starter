export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { userService } from "@/features/user/services/server/userService";
import { userTagService } from "@/features/core/userTag/services/server/userTagService";
import AdminUserTagEdit from "@/features/core/userTag/components/AdminUserTagEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { UserTag } from "@/features/core/userTag/entities";

export const metadata = {
  title: "ユーザータグ編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserTagEditPage({ params }: Props) {
  const { id } = await params;
  const [userTag, users ] = await Promise.all([
    userTagService.get(id),
    userService.list()
  ]);


  return (
  <SWRConfig
    value={{
      fallback: { users },
  }}
  >

    <AdminPage>
      <PageTitle>ユーザータグ編集</PageTitle>
      <AdminUserTagEdit userTag={userTag as UserTag} redirectPath="/admin/user-tags" />
    </AdminPage>
  </SWRConfig>
  );
}
