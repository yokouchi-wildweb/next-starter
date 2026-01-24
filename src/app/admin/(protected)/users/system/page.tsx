// src/app/admin/users/system/page.tsx

export const dynamic = "force-dynamic";

import ManagerialUserList from "@/features/core/user/components/admin/ManagerialUserList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { userService } from "@/features/core/user/services/server/userService";
import { getRolesByCategory } from "@/features/core/user/constants";
import type { ListPageSearchParams, WhereExpr } from "@/lib/crud";

export const metadata = {
  title: "システム管理者",
};

const LIST_PATH = "/admin/users/system";

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminSystemUserListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();

  // admin系カテゴリのロールでフィルタ
  const adminRoles = getRolesByCategory("admin");
  const roleConditions: WhereExpr[] = adminRoles.map((role) => ({
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
      <PageTitle>システム管理者</PageTitle>
      <ManagerialUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済みシステム管理者の一覧"
        listPath={LIST_PATH}
        searchPlaceholder="管理者名またはメールアドレスで検索"
      />
    </AdminPage>
  );
}
