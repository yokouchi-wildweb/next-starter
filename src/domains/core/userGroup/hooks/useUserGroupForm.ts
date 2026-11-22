"use client";

// src/domains/core/userGroup/hooks/useUserGroupForm.ts
//
// 管理: ユーザーグループを作る・直すモーダルの書く欄と操作(部品はこれを呼んで描くだけ。CLAUDE.md core_ui)。
// - 欄: 名前・説明・種類・定期計算の間隔・条件の組み立て(useUserGroupConditionBuilder)・固定の一員の元(作る時だけ)
// - 種類: 作る = 動的・定期計算・固定 / 直す = 動的 ⇄ 定期計算だけ(固定は固定のまま。サーバーも同じ規則)
// - 保存: 動的・定期計算を作る = POST(定義つき)/ 固定を作る = startStatic(一員の元から。送り直しは useUserGroupFreeze)/
//   直す = PATCH(変えた欄だけ。読むだけの条件は組み直さない限り送らない)
// - 重い条件の注意: 動的で重い部品を含む = 1 人ずつの確かめ(限定ページ・参加資格)に使えない、定期計算をすすめる
// - 書きかけがある間は離れる前に確かめる(@/lib/unsavedGuard。モーダルを閉じる前は closeConfirm)

import { useCallback, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import {
  archiveUserGroup,
  restoreUserGroup,
  createUserGroup,
  updateUserGroup,
  type AdminUserGroupCriteriaCatalog,
  type AdminUserGroupDetail,
  type CreateUserGroupInput,
  type StaticMemberSource,
  type UpdateUserGroupInput,
  type UserGroupKind,
} from "../services/client/userGroupAdminClient";

import type { UserGroupAction } from "./useAdminUserGroupList";
import { useUserGroupConditionBuilder } from "./useUserGroupConditionBuilder";
import type { StartUserGroupFreezeInput } from "./useUserGroupFreeze";
import { USER_GROUPS_KEY, userGroupKey } from "./userGroupKeys";

/** 定期計算の間隔の選択肢(分。null = 設定の既定) */
export const RECOMPUTE_INTERVAL_CHOICES: readonly number[] = [60, 180, 360, 720, 1440, 4320, 10080];

/** 間隔の表示(分 → 「6 時間ごと」「1 日ごと」) */
export function intervalLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} 日ごと`;
  if (minutes % 60 === 0) return `${minutes / 60} 時間ごと`;
  return `${minutes} 分ごと`;
}

export const HEAVY_WARNING =
  "処理が重い条件が含まれています。「自動で都度抽出」のままでは、1 人ずつの判定(限定ページ・参加資格など)に使えません。「定期的に更新」にすると使えます";

/** 固定のグループの一員の元(作る時) */
export type StaticSourceDraft = { type: "users" | "tag" | "group"; userIds: string[]; tagId: string; groupId: string };

export const STATIC_SOURCE_LABELS: Record<StaticSourceDraft["type"], string> = {
  users: "ユーザーを選ぶ",
  tag: "タグを持つユーザー",
  group: "別の固定グループのメンバー",
};

export function staticSourceOf(draft: StaticSourceDraft): StaticMemberSource | null {
  if (draft.type === "users") return { type: "users", userIds: draft.userIds };
  if (draft.type === "tag") return draft.tagId ? { type: "tag", tagId: draft.tagId } : null;
  return draft.groupId ? { type: "group", groupId: draft.groupId } : null;
}

export type UseUserGroupFormOptions = {
  /** 直す 1 件(省略 = 作る) */
  group?: AdminUserGroupDetail | null;
  catalog: AdminUserGroupCriteriaCatalog | null;
  /** 作った後(id)。モーダルはこれで同じ 1 件を直す形に変わる */
  onCreated?: (id: string) => void;
  /** 作る・保存・保管が通った後(返った 1 件と操作) */
  onChanged?: (group: AdminUserGroupDetail, action: UserGroupAction) => void;
  /** 固定のグループを作る(一員の元から。useUserGroupFreeze の start) */
  startStatic?: (input: StartUserGroupFreezeInput) => Promise<unknown>;
};

export function useUserGroupForm({ group, catalog, onCreated, onChanged, startStatic }: UseUserGroupFormOptions) {
  const { showToast } = useToast();
  const id = group?.id ?? null;
  const archived = group?.status === "archived";
  const criteria = useMemo(() => catalog?.criteria ?? [], [catalog]);

  const initialKind: UserGroupKind = group?.kind ?? "dynamic";
  const initialInterval = group?.recompute?.intervalMinutes ?? null;
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [kind, setKindState] = useState<UserGroupKind>(initialKind);
  const [intervalMinutes, setIntervalMinutes] = useState<number | null>(initialInterval);
  const [source, setSource] = useState<StaticSourceDraft>({ type: "users", userIds: [], tagId: "", groupId: "" });
  // 作る時の例外の人(動的・定期計算。作成の時にグループと同じ取引で書く。同じ人は片方だけ)
  const [draftInclude, setDraftInclude] = useState<string[]>([]);
  const [draftExclude, setDraftExclude] = useState<string[]>([]);
  const condition = useUserGroupConditionBuilder({ definition: group?.definition ?? null, criteria });

  const kindOptions = useMemo(() => {
    const all = catalog?.kinds ?? [];
    if (!group) return all;
    if (group.kind === "static") return all.filter((option) => option.value === "static");
    return all.filter((option) => option.value !== "static");
  }, [catalog, group]);
  const setKind = useCallback(
    (next: string) => {
      if (kindOptions.some((option) => option.value === next)) setKindState(next as UserGroupKind);
    },
    [kindOptions],
  );

  const revalidateKeys = id ? [userGroupKey(id), USER_GROUPS_KEY] : [USER_GROUPS_KEY];
  const createMutation = useDomainMutation<AdminUserGroupDetail, CreateUserGroupInput>(
    `${USER_GROUPS_KEY}/create`,
    (input) => createUserGroup(input),
    USER_GROUPS_KEY,
  );
  const updateMutation = useDomainMutation<AdminUserGroupDetail, UpdateUserGroupInput>(
    `${USER_GROUPS_KEY}/${id ?? "new"}/update`,
    (input) => updateUserGroup(id!, input),
    revalidateKeys,
  );
  const archiveMutation = useDomainMutation<AdminUserGroupDetail, void>(
    `${USER_GROUPS_KEY}/${id ?? "new"}/archive`,
    () => archiveUserGroup(id!),
    revalidateKeys,
  );
  const restoreMutation = useDomainMutation<AdminUserGroupDetail, void>(
    `${USER_GROUPS_KEY}/${id ?? "new"}/restore`,
    () => restoreUserGroup(id!),
    revalidateKeys,
  );

  const trimmedDescription = description.trim() === "" ? null : description.trim();
  const usesCondition = kind !== "static";

  /** 直す時に送る欄(変えた物だけ) */
  const patch = useMemo((): UpdateUserGroupInput => {
    if (!group) return {};
    const out: UpdateUserGroupInput = {};
    if (name.trim() !== group.name) out.name = name.trim();
    if (trimmedDescription !== (group.description ?? null)) out.description = trimmedDescription;
    if (kind !== group.kind) out.kind = kind;
    if (kind === "scheduled" && intervalMinutes !== initialInterval) out.recomputeIntervalMinutes = intervalMinutes;
    if (usesCondition && condition.touched) {
      const definition = condition.toDefinition();
      if (definition) out.definition = definition;
    }
    return out;
  }, [group, name, trimmedDescription, kind, intervalMinutes, initialInterval, usesCondition, condition]);

  const dirty = group
    ? Object.keys(patch).length > 0
    : name.trim() !== "" ||
      trimmedDescription !== null ||
      kind !== "dynamic" ||
      condition.touched ||
      source.userIds.length > 0 ||
      source.tagId !== "" ||
      source.groupId !== "" ||
      draftInclude.length > 0 ||
      draftExclude.length > 0;
  useUnsavedGuard(dirty);

  const heavy = usesCondition && (condition.readOnly ? Boolean(group?.heavy) : condition.heavy);
  const problems = useMemo(() => {
    const out: string[] = [];
    if (name.trim() === "") out.push("グループ名を入力してください");
    if (usesCondition) out.push(...condition.problems);
    if (!group && kind === "static" && staticSourceOf(source) === null) out.push("メンバーの指定方法を選んでください");
    return out;
  }, [name, usesCondition, condition.problems, group, kind, source]);

  /** 保存(作る or 直す。ボタンが Promise の間 loading) */
  const save = useCallback(async () => {
    try {
      if (id) {
        const updated = await updateMutation.trigger(patch);
        onChanged?.(updated, "update");
        showToast("保存しました", "success");
        return;
      }
      if (kind === "static") {
        const from = staticSourceOf(source);
        if (!from || !startStatic) return;
        await startStatic({ name: name.trim(), description: trimmedDescription, from });
        return;
      }
      const definition = condition.toDefinition();
      if (!definition) return;
      const created = await createMutation.trigger({
        name: name.trim(),
        description: trimmedDescription,
        kind,
        definition,
        ...(kind === "scheduled" ? { recomputeIntervalMinutes: intervalMinutes } : {}),
        ...(draftInclude.length > 0 || draftExclude.length > 0 ? { exceptions: { include: draftInclude, exclude: draftExclude } } : {}),
      });
      onCreated?.(created.id);
      onChanged?.(created, "create");
      showToast("グループを作成しました", "success");
    } catch (e) {
      showToast(err(e, "保存できませんでした"), "error");
    }
  }, [id, updateMutation, patch, onChanged, showToast, kind, source, startStatic, name, trimmedDescription, condition, createMutation, intervalMinutes, onCreated, draftInclude, draftExclude]);

  /** 保管(一覧の既定と選択肢に出さない) */
  const archive = useCallback(async () => {
    if (!id) return;
    try {
      const done = await archiveMutation.trigger();
      onChanged?.(done, "archive");
      showToast("アーカイブしました", "success");
    } catch (e) {
      showToast(err(e, "アーカイブできませんでした"), "error");
    }
  }, [id, archiveMutation, onChanged, showToast]);

  /** アーカイブしたグループを使用中に戻す(戻した後は直せる) */
  const restore = useCallback(async () => {
    if (!id) return;
    try {
      const done = await restoreMutation.trigger();
      onChanged?.(done, "restore");
      showToast("使用中に戻しました", "success");
    } catch (e) {
      showToast(err(e, "使用中に戻せませんでした"), "error");
    }
  }, [id, restoreMutation, onChanged, showToast]);

  return {
    mode: id ? ("edit" as const) : ("create" as const),
    archived,
    dirty,
    problems,
    canSave: dirty && problems.length === 0 && !archived,
    save,
    archive,
    restore,
    /** 重い条件の注意(出さない = null) */
    heavyWarning: kind === "dynamic" && heavy ? HEAVY_WARNING : null,
    /** モーダルを閉じる前の確かめ(Modal の confirmOnClose に渡す) */
    closeConfirm: { enabled: dirty, message: "保存していない変更があります。閉じてもよろしいですか？" },
    condition,
    /** 作る時の例外の人(片方に入れた人はもう片方から外す) */
    exceptionsDraft: {
      include: draftInclude,
      exclude: draftExclude,
      setInclude: (values: readonly (string | number | boolean)[]) => {
        const next = values.map(String);
        setDraftInclude(next);
        setDraftExclude((prev) => prev.filter((userId) => !next.includes(userId)));
      },
      setExclude: (values: readonly (string | number | boolean)[]) => {
        const next = values.map(String);
        setDraftExclude(next);
        setDraftInclude((prev) => prev.filter((userId) => !next.includes(userId)));
      },
    },
    fields: {
      name,
      setName,
      description,
      setDescription,
      kind,
      setKind,
      kindOptions,
      /** 種類を変えられるか(固定のグループ・保管したものは変えられない) */
      kindLocked: archived || group?.kind === "static",
      intervalMinutes,
      setIntervalMinutes,
      intervalChoices: RECOMPUTE_INTERVAL_CHOICES,
      defaultIntervalMinutes: group?.recompute?.defaultIntervalMinutes ?? null,
      source,
      setSource,
    },
  };
}

export type UserGroupFormState = ReturnType<typeof useUserGroupForm>;
