"use client";

// src/features/core/userGroup/hooks/useUserGroupMembershipEditor.ts
//
// 管理: 人の選ぶ部品を「その場で一員を直す」形にする流れ(D101)。対象 = 一員(固定)/ 入れる人 / 外す人(例外)。
// - 候補 = people-search(カーソル、D102)。行ごとの印 inList(対象に入っている)・otherSide(例外の反対側)を覚える
// - 部品の値 = 入っている人(見えた分)− 外す予定 + 足す予定。チェックを付ける・外すと予定が変わる
// - 印: 反対側にいる人は「除外中」/「含める中」(部品の optionBadge)
// - apply() = people-apply を 1 回(読み込みの知らせ)→ 結果を知らせて予定を空に、印を忘れる(次に開いた時に取り直す)→ onApplied

import { useCallback, useMemo, useRef, useState } from "react";

import type { OptionPrimitive } from "@/components/Form/utils";
import { err } from "@/lib/errors";
import { useLoadingToast, useToast } from "@/lib/toast";

import {
  applyUserGroupPeople,
  searchUserGroupPeople,
  type AdminUserGroupPeopleApplied,
  type AdminUserGroupPerson,
} from "../services/client/userGroupAdminClient";

export type UserGroupPeopleTarget = "members" | "include" | "exclude";

export type UseUserGroupMembershipEditorOptions = {
  groupId: string | null;
  target: UserGroupPeopleTarget;
  /** 適用の後(要約・人数を取り直す) */
  onApplied?: (result: AdminUserGroupPeopleApplied) => void;
};

type Flags = { inList: boolean; otherSide: AdminUserGroupPerson["otherSide"] };

export function useUserGroupMembershipEditor({ groupId, target, onApplied }: UseUserGroupMembershipEditorOptions) {
  const { showToast } = useToast();
  const flagsRef = useRef<Map<string, Flags>>(new Map());
  const [flagsVersion, setFlagsVersion] = useState(0);
  const [pendingAdd, setPendingAdd] = useState<ReadonlySet<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<ReadonlySet<string>>(new Set());
  const [applying, setApplying] = useState(false);
  useLoadingToast(applying, "適用しています…");

  /** 部品の cursorFn(印を覚える) */
  const cursorFn = useCallback(
    async ({ searchQuery, cursor, limit }: { searchQuery?: string; cursor: string | null; limit: number }) => {
      if (!groupId) return { items: [] as AdminUserGroupPerson[], nextCursor: null };
      const page = await searchUserGroupPeople(groupId, { target, q: searchQuery, cursor, limit });
      for (const person of page.items) flagsRef.current.set(person.id, { inList: person.inList, otherSide: person.otherSide });
      setFlagsVersion((v) => v + 1);
      return page;
    },
    [groupId, target],
  );

  const getOptionFromResult = useCallback((person: AdminUserGroupPerson) => ({ value: person.id, label: person.name ?? "名前未設定のユーザー" }), []);

  /** 部品の値(入っている人 − 外す予定 + 足す予定) */
  const value = useMemo(() => {
    const out: string[] = [];
    for (const [id, flags] of flagsRef.current) if (flags.inList && !pendingRemove.has(id)) out.push(id);
    for (const id of pendingAdd) if (!out.includes(id)) out.push(id);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flagsRef の中身は flagsVersion で読み直す
  }, [flagsVersion, pendingAdd, pendingRemove]);

  const onChange = useCallback(
    (next: OptionPrimitive[]) => {
      const nextSet = new Set(next.map(String));
      const prevSet = new Set(value);
      const add = new Set(pendingAdd);
      const remove = new Set(pendingRemove);
      for (const id of nextSet) {
        if (prevSet.has(id)) continue;
        if (flagsRef.current.get(id)?.inList) remove.delete(id);
        else add.add(id);
      }
      for (const id of prevSet) {
        if (nextSet.has(id)) continue;
        if (flagsRef.current.get(id)?.inList) remove.add(id);
        else add.delete(id);
      }
      setPendingAdd(add);
      setPendingRemove(remove);
    },
    [value, pendingAdd, pendingRemove],
  );

  const optionBadge = useCallback(
    (optionValue: OptionPrimitive) => {
      const side = flagsRef.current.get(String(optionValue))?.otherSide ?? null;
      return side === "exclude" ? "除外中" : side === "include" ? "含める中" : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flagsRef の中身は flagsVersion で読み直す
    [flagsVersion],
  );

  const apply = useCallback(async () => {
    if (!groupId || (pendingAdd.size === 0 && pendingRemove.size === 0)) return;
    setApplying(true);
    try {
      const result = await applyUserGroupPeople(groupId, { target, add: [...pendingAdd], remove: [...pendingRemove] });
      setPendingAdd(new Set());
      setPendingRemove(new Set());
      flagsRef.current.clear();
      setFlagsVersion((v) => v + 1);
      const parts = [`追加 ${result.added} 名`, `削除 ${result.removed} 名`, ...(result.moved > 0 ? [`反対側から移動 ${result.moved} 名`] : [])];
      showToast(`適用しました(${parts.join("・")})`, "success");
      onApplied?.(result);
    } catch (error) {
      showToast(err(error, "変更を適用できませんでした"), "error");
    } finally {
      setApplying(false);
    }
  }, [groupId, target, pendingAdd, pendingRemove, showToast, onApplied]);

  return {
    cursorFn,
    getOptionFromResult,
    value,
    onChange,
    optionBadge,
    /** 足す予定・外す予定の人数(適用のボタンの文言) */
    addCount: pendingAdd.size,
    removeCount: pendingRemove.size,
    applying,
    apply,
  };
}

export type UserGroupMembershipEditorState = ReturnType<typeof useUserGroupMembershipEditor>;
