// src/features/notificationTemplate/components/AdminNotificationTemplateList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Pagination } from "@/components/Navigation";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/core/notificationTemplate/domain.json";
import { CreateButton } from "@/lib/crud";
import { getAdminPaths } from "@/lib/crud/utils";

const paths = getAdminPaths("notification-templates");
const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;

export type AdminNotificationTemplateListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminNotificationTemplateListHeader({ page, perPage, total }: AdminNotificationTemplateListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="登録済みお知らせテンプレートの一覧">
      {hasSearch && <SearchBox makeHref={(p) => `${paths.list}?${p.toString()}`} />}
      {config.useImportExport === true && (
        <DataMigrationButton domain={config.singular} searchParams={params.toString()} />
      )}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `${paths.list}?${search.toString()}`;
        }}
      />
      <CreateButton domain="notificationTemplate" />
    </ListTop>
  );
}
