"use client";

// src/features/core/userGroup/hooks/useUserGroupFreeze.ts
//
// 管理: 固定のグループ(静的)を一員の元から作る流れ。元 = 選んだ人 / タグの今の持ち主 / グループの今の一員(D51: 元は残し、新しい静的グループを作る)。
// - 1 回目は POST /api/admin/user-groups/static。一員の書き込みが途中(members.status incomplete)なら、
//   同じ元で POST [id]/members { mode: "replace", from } を送り直す(サーバーが続きから書く)。終わるまで自動で繰り返し、進み具合を返す
// - onStarted(group) = グループができた(1 回目の後。一覧の取り直し・モーダルの開き先に)/ onDone(group) = 一員を書き終えた
// - cancel() / 外れた時(unmount)は送り直しを止める(グループは前の一員 = 空のまま残る。同じ元で入れ替えれば続きから)

import { useCallback, useEffect, useRef, useState } from "react";

import { err } from "@/lib/errors";

import {
  createStaticUserGroup,
  updateStaticMembers,
  type AdminStaticGroupResult,
  type AdminUserGroupDetail,
  type StaticMemberSource,
} from "../services/client/userGroupAdminClient";

/** 送り直しの上限(サーバーは 1 回ごとに必ず進む。尽きたら止めて理由を出す) */
export const FREEZE_MAX_ROUNDS = 500;

export type UserGroupFreezeProgress =
  | { status: "idle" }
  | { status: "running"; rounds: number; staged: number; groupName: string | null }
  | { status: "done"; memberCount: number; skipped: number; group: AdminUserGroupDetail }
  | { status: "failed"; reason: string; group: AdminUserGroupDetail | null };

export type StartUserGroupFreezeInput = { name: string; description?: string | null; from: StaticMemberSource };

export type UseUserGroupFreezeOptions = {
  onStarted?: (group: AdminUserGroupDetail) => void;
  onDone?: (group: AdminUserGroupDetail) => void;
};

export function useUserGroupFreeze({ onStarted, onDone }: UseUserGroupFreezeOptions = {}) {
  const [progress, setProgress] = useState<UserGroupFreezeProgress>({ status: "idle" });
  const run = useRef(0);
  const callbacks = useRef({ onStarted, onDone });
  useEffect(() => {
    callbacks.current = { onStarted, onDone };
  }, [onStarted, onDone]);
  useEffect(
    () => () => {
      run.current += 1;
    },
    [],
  );

  const start = useCallback(async (input: StartUserGroupFreezeInput): Promise<AdminUserGroupDetail | null> => {
    const id = ++run.current;
    const alive = () => run.current === id;
    setProgress({ status: "running", rounds: 0, staged: 0, groupName: null });
    let group: AdminUserGroupDetail | null = null;
    try {
      let result: AdminStaticGroupResult = await createStaticUserGroup({ name: input.name, description: input.description ?? null, from: input.from });
      group = result.group;
      if (!alive()) return null;
      callbacks.current.onStarted?.(group);
      let rounds = 0;
      while (result.members.status === "incomplete") {
        rounds += 1;
        setProgress({ status: "running", rounds, staged: result.members.staged, groupName: group.name });
        if (rounds > FREEZE_MAX_ROUNDS) throw new Error("一員の書き込みが終わりませんでした。もう一度お試しください");
        const next = await updateStaticMembers(group.id, { mode: "replace", from: input.from });
        if (!alive()) return null;
        result = next as AdminStaticGroupResult;
        group = result.group;
      }
      const members = result.members;
      const memberCount = "memberCount" in members ? members.memberCount : 0;
      setProgress({ status: "done", memberCount, skipped: members.skipped, group });
      callbacks.current.onDone?.(group);
      return group;
    } catch (error) {
      if (alive()) setProgress({ status: "failed", reason: err(error, "固定のグループを作れませんでした"), group });
      return null;
    }
  }, []);

  /** 送り直しを止める */
  const cancel = useCallback(() => {
    run.current += 1;
    setProgress((prev) => (prev.status === "running" ? { status: "idle" } : prev));
  }, []);
  const clear = useCallback(() => setProgress({ status: "idle" }), []);

  return { progress, running: progress.status === "running", start, cancel, clear };
}

export type UserGroupFreezeState = ReturnType<typeof useUserGroupFreeze>;
