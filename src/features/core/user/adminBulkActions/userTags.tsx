// src/features/core/user/adminBulkActions/userTags.tsx
// 一般ユーザーの一覧: 選んだユーザーのタグを一括で設定する(選んだタグの組に置き換える)。上流の既定の項目(D149)。
// 足すだけにしたい fork は、自分の項目を bulkRelationAction(..., { mode: "add" }) で足し、これを userTags.override.ts で enabled: false にする

import { Tags } from "lucide-react";

import { bulkRelationAction } from "@/lib/crud/components";
import { domainDisplay as userDisplay } from "@/features/core/user/entities/display";
import type { UserAdminBulkActionItem } from "@/features/core/user/types";

export const bulkAction: UserAdminBulkActionItem = {
  ...bulkRelationAction(
    {
      key: "userTags",
      lists: ["general"],
      order: 10,
    },
    {
      domain: userDisplay,
      relation: "userTag",
      mode: "replace",
      icon: Tags,
      label: "タグ設定",
      searchable: true,
      showSelectAll: true,
      showClearAll: true,
    },
  ),
};
