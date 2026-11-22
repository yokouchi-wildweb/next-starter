"use client";

// src/domains/core/user/adminBulkActions/userGroupCreate.tsx
// 一般ユーザーの一覧: 選んだユーザーで固定のユーザーグループを作る(名前・説明を入れる)。上流の既定の項目。
// 本体は userGroup の作成関数 bulkCreateUserGroupAction。門 userGroups(既定 閉)が閉なら出さない:
// 一覧の出し分けは feature、部品も useGate().enabled("userGroups") で確かめてから描く(門の依存の検査の形 2)

import type { BulkActionProps } from "@/lib/tableSuite";
import { useGate } from "@/featureGate/client";
import { bulkCreateUserGroupAction } from "@/domains/core/userGroup/components/AdminUserGroupBulkActions";
import type { User } from "@/domains/core/user/entities";
import type { AdminBulkActionAccess, UserAdminBulkActionItem } from "@/domains/core/user/types";

const base = bulkCreateUserGroupAction<User, AdminBulkActionAccess>({ key: "userGroupCreate", lists: ["general"], order: 20 });

function Gated(props: BulkActionProps<User>) {
  const Component = base.Component;
  return useGate().enabled("userGroups") ? <Component {...props} /> : null;
}

export const bulkAction: UserAdminBulkActionItem = { ...base, Component: Gated, feature: "userGroups" };
