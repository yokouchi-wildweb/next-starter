"use client";

// src/features/core/userGroup/hooks/useUserGroupEstimate.ts
//
// 管理: 人数の見込みと試しの一覧(保存しないその場の定義)。押した時だけ数える(重い条件で一覧を待たせない)。
// - 結果は数えた定義の物。定義を変えたら stale(古い見込み)を返す
// - 数えられない理由(時間の上限 503・定義の誤り 400 など)はサーバーの言葉のまま reason に

import { useCallback, useState } from "react";

import { err } from "@/lib/errors";

import { estimateUserGroup, type AdminUserGroupEstimate, type UserGroupDefinitionNode } from "../services/client/userGroupAdminClient";

type Outcome = { forJson: string; result: AdminUserGroupEstimate | null; reason: string | null };

export function useUserGroupEstimate(definition: UserGroupDefinitionNode | null) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const json = definition ? JSON.stringify(definition) : null;

  const run = useCallback(async () => {
    if (!definition || json === null) return;
    setIsLoading(true);
    try {
      const result = await estimateUserGroup({ definition });
      setOutcome({ forJson: json, result, reason: null });
    } catch (error) {
      setOutcome({ forJson: json, result: null, reason: err(error, "対象人数を見積もれませんでした") });
    } finally {
      setIsLoading(false);
    }
  }, [definition, json]);

  return {
    result: outcome?.result ?? null,
    reason: outcome?.reason ?? null,
    isLoading,
    /** 数えた後に定義を変えた */
    stale: outcome !== null && outcome.forJson !== json,
    canRun: definition !== null && !isLoading,
    run,
  };
}

export type UserGroupEstimateState = ReturnType<typeof useUserGroupEstimate>;
