// src/app/admin/users/system/page.tsx

export const dynamic = "force-dynamic";

import ManagerialUserList from "@/features/core/user/components/admin/ManagerialUserList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { userService } from "@/features/core/user/services/server/userService";
import { getRolesByCategory } from "@/features/core/user/constants";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";
import type { ListPageSearchParams, WhereExpr, OrderBySpec } from "@/lib/crud";

/**
 * 検索クエリが日本の電話番号形式（0始まりの数字列）の場合、E.164形式に変換する
 * 例: "090-1234-5678" → "+819012345678", "090" → "+8190"
 */
function normalizePhoneSearchQuery(query: string | undefined): string | undefined {
  if (!query) return query;
  const cleaned = query.replace(/[-\s()]/g, "");
  if (/^0\d+$/.test(cleaned)) {
    return formatToE164(query);
  }
  return query;
}

export const metadata = {
  title: "システム管理者",
};

const LIST_PATH = "/admin/users/system";

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminSystemUserListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery, sortBy } = await searchParams;
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

  // 並び替え
  const orderByField = sortBy === "updatedAt" ? "updatedAt" : "createdAt";
  const orderBy: OrderBySpec = [[orderByField, "DESC"]];

  const { results: users, total } = await userService.search({
    page,
    limit: perPage,
    where,
    searchQuery: normalizePhoneSearchQuery(searchQuery),
    orderBy,
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
        sortBy={sortBy}
      />
    </AdminPage>
  );
}
