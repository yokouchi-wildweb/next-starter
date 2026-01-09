// src/app/admin/users/general/page.tsx

export const dynamic = "force-dynamic";

import GeneralUserList from "@/features/core/user/components/admin/GeneralUserList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { userService } from "@/features/core/user/services/server/userService";
import type { ListPageSearchParams } from "@/types/page";
import type { WhereExpr } from "@/lib/crud";

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
  const where: WhereExpr = {
    and: [
      { field: "role", op: "eq", value: "user" },
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
        newHref={`${LIST_PATH}/new`}
        listPath={LIST_PATH}
      />
    </AdminPage>
  );
}
