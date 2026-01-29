// src/app/admin/users/demo/page.tsx

export const dynamic = "force-dynamic";

import DemoUserList from "@/features/core/user/components/admin/DemoUserList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { userService } from "@/features/core/user/services/server/userService";
import type { ListPageSearchParams, WhereExpr, OrderBySpec } from "@/lib/crud";

export const metadata = {
  title: "デモユーザー",
};

const LIST_PATH = "/admin/users/demo";

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminDemoUserListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery, sortBy } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();
  const where: WhereExpr = { field: "isDemo", op: "eq", value: true };

  // 並び替え
  const orderByField = sortBy === "updatedAt" ? "updatedAt" : "createdAt";
  const orderBy: OrderBySpec = [[orderByField, "DESC"]];

  const { results: users, total } = await userService.search({
    page,
    limit: perPage,
    where,
    searchQuery,
    orderBy,
  });

  return (
    <AdminPage>
      <PageTitle>デモユーザー</PageTitle>
      <DemoUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済みデモユーザーの一覧"
        listPath={LIST_PATH}
        sortBy={sortBy}
      />
    </AdminPage>
  );
}
