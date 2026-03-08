// src/features/chatRoom/components/AdminChatRoomList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Pagination } from "@/components/Navigation";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/core/chatRoom/domain.json";
import { CreateButton } from "@/lib/crud";
import { getAdminPaths } from "@/lib/crud/utils";

const paths = getAdminPaths("chat-rooms");
const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;

export type AdminChatRoomListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminChatRoomListHeader({ page, perPage, total }: AdminChatRoomListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="登録済みチャットルームの一覧">
      {hasSearch && <SearchBox makeHref={(p) => `${paths.list}?${p.toString()}`} />}
      {"useImportExport" in config && config.useImportExport === true && (
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
      <CreateButton domain="chatRoom" />
    </ListTop>
  );
}
