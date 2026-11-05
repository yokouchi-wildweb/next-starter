// src/features/core/user/hooks/useAdminBulkActionCan.ts
// 一括操作の項目の access(AdminBulkActionAccess)を、今の管理者のロールで判定する述語(表示の出し分け。守りは API)

"use client";

import { useCallback } from "react";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import type { AdminBulkActionAccess } from "@/features/core/user/types";

export function useAdminBulkActionCan(): (access: AdminBulkActionAccess) => boolean {
  const { user } = useAuthSession();
  const role = user?.role;
  return useCallback((access: AdminBulkActionAccess) => role !== undefined && access.roles.includes(role as never), [role]);
}
