// src/app/admin/users/managerial/page.tsx

export const dynamic = "force-dynamic";

import ManagerialUserList from "@/features/user/components/admin/ManagerialUserList";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";
import { settingService } from "@/features/setting/services/server/settingService";
import { userService } from "@/features/user/services/server/userService";
import type { ListPageSearchParams } from "@/types/page";
import type { WhereExpr } from "@/lib/crud";

export const metadata = {
  title: "システム管理者",
};

const LIST_PATH = "/admin/users/managerial";

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminManagerialUserListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();
  const where: WhereExpr = { field: "role", op: "eq", value: "admin" };
  const { results: users, total } = await userService.search({
    page,
    limit: perPage,
    where,
    searchQuery,
  });

  return (
    <Main containerType="plain">
      <AdminPageTitle>システム管理者</AdminPageTitle>
      <ManagerialUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済みシステム管理者の一覧"
        newHref={`${LIST_PATH}/new`}
        listPath={LIST_PATH}
        searchPlaceholder="管理者名またはメールアドレスで検索"
      />
    </Main>
  );
}
