"use client";

// src/domains/core/userGroup/hooks/useAddToUserGroup.ts
//
// 管理: 選んだ利用者を既存の固定のグループ(静的)に足す流れ(利用者一覧の一括操作「固定のグループに足す」が使う)。
// - 口: POST /api/admin/user-groups/[id]/members { mode: "add", userIds }
// - 結果は足した人数・入らなかった人数・足した後の人数。断られた理由(人数の上限 409 など)はサーバーの言葉のまま reason に

import { useCallback, useState } from "react";

import { err } from "@/lib/errors";

import { updateStaticMembers, type AdminUserGroupDetail } from "../services/client/userGroupAdminClient";

export type AddToUserGroupResult = { group: AdminUserGroupDetail; added: number; skipped: number; memberCount: number };

export function useAddToUserGroup() {
  const [isAdding, setIsAdding] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<AddToUserGroupResult | null>(null);

  /** 足す(通れば結果、断られたら null と reason) */
  const add = useCallback(async (groupId: string, userIds: readonly string[]): Promise<AddToUserGroupResult | null> => {
    setIsAdding(true);
    setReason(null);
    try {
      const response = await updateStaticMembers(groupId, { mode: "add", userIds: [...userIds] });
      if (!("group" in response) || response.members.status !== "added") throw new Error("固定グループに追加できませんでした");
      const done = { group: response.group, added: response.members.added, skipped: response.members.skipped, memberCount: response.members.memberCount };
      setResult(done);
      return done;
    } catch (error) {
      setReason(err(error, "固定グループに追加できませんでした"));
      return null;
    } finally {
      setIsAdding(false);
    }
  }, []);

  const clear = useCallback(() => {
    setReason(null);
    setResult(null);
  }, []);

  return { add, isAdding, reason, result, clear };
}

export type AddToUserGroupState = ReturnType<typeof useAddToUserGroup>;
