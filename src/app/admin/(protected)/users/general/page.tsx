// src/app/admin/users/general/page.tsx

export const dynamic = "force-dynamic";

import GeneralUserList from "@/features/core/user/components/admin/GeneralUserList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { userService } from "@/features/core/user/services/server/userService";
import { getRolesByCategory } from "@/features/core/user/constants";
import type { ListPageSearchParams, WhereExpr } from "@/lib/crud";

export const metadata = {
  title: "登録ユーザー",
};

const LIST_PATH = "/admin/users/general";

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminGeneralUserListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();

  // user系カテゴリのロールでフィルタ
  const userRoles = getRolesByCategory("user");
  const roleConditions: WhereExpr[] = userRoles.map((role) => ({
    field: "role",
    op: "eq" as const,
    value: role,
  }));
  const where: WhereExpr = {
    and: [
      { or: roleConditions },
      { field: "isDemo", op: "eq", value: false },
    ],
  };

  const { results: users, total } = await userService.search({
    page,
    limit: perPage,
    where,
    searchQuery,
  });

  return (
    <AdminPage>
      <PageTitle>登録ユーザー</PageTitle>
      <GeneralUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済み一般ユーザーの一覧"
        listPath={LIST_PATH}
      />
    </AdminPage>
  );
}
