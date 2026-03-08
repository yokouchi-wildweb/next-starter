// src/features/notification/components/AdminNotificationList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Pagination } from "@/components/Navigation";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { useSearchParams } from "next/navigation";
import config from "@/features/notification/domain.json";
import { CreateButton } from "@/lib/crud";
import { Send } from "lucide-react";

const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;

export type AdminNotificationListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminNotificationListHeader({ page, perPage, total }: AdminNotificationListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="送信済みお知らせの一覧">
      {hasSearch && <SearchBox makeHref={(p) => `/admin/notifications?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/notifications?${search.toString()}`;
        }}
      />
      <CreateButton label="新規送信" icon={Send} href="/admin/notifications/send" />
    </ListTop>
  );
}
