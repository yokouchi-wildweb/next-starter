// src/app/admin/users/general/page.tsx

export const dynamic = "force-dynamic";

import GeneralUserList from "@/features/user/components/admin/GeneralUserList";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";
import { settingService } from "@/features/setting/services/server/settingService";
import { userService } from "@/features/user/services/server/userService";
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
  const where: WhereExpr = { field: "role", op: "eq", value: "user" };
  const { results: users, total } = await userService.search({
    page,
    limit: perPage,
    where,
    searchQuery,
  });

  return (
    <Main containerType="plain" className="p-6 space-y-6">
      <AdminPageTitle>登録ユーザー</AdminPageTitle>
      <GeneralUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済み一般ユーザーの一覧"
        newHref={`${LIST_PATH}/new`}
        listPath={LIST_PATH}
      />
    </Main>
  );
}
