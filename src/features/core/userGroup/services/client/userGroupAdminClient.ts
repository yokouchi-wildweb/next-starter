"use client";

// src/features/core/userGroup/services/client/userGroupAdminClient.ts
//
// ユーザーグループの管理 API(/api/admin/user-groups/**)。門 userGroups が閉なら 404。一覧・一員・例外の人はカーソル。
// 型は server の DTO(services/server/admin/dto.ts)と入力の zod(schema.ts)を型だけ読む。
// 一員・例外の人の一覧は limit 1〜100(既定 50)、種類の違うグループには 409

import axios from "axios";
import type { z } from "zod";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminStaticGroupResult,
  AdminStaticMembersRemoved,
  AdminUserGroupCount,
  AdminUserGroupCriteriaCatalog,
  AdminUserGroupDeleted,
  AdminUserGroupDetail,
  AdminUserGroupEstimate,
  AdminUserGroupMember,
  AdminUserGroupMemberPage,
  AdminUserGroupOption,
  AdminUserGroupPeopleApplied,
  AdminUserGroupPeoplePage,
  AdminUserGroupPerson,
  AdminUserGroupPage,
  AdminUserGroupRecompute,
  AdminUserGroupSampleUser,
  AdminUserGroupSummary,
} from "@/features/core/userGroup/services/server/admin/dto";
import type {
  CreateStaticUserGroupInputSchema,
  CreateUserGroupInputSchema,
  StaticMemberSource,
  UpdateStaticMembersInputSchema,
  UpdateUserGroupExceptionsInputSchema,
  UpdateUserGroupInputSchema,
} from "@/features/core/userGroup/services/server/admin/schema";
import type { UserGroupDefinitionNode, UserGroupKind, UserGroupStatus } from "@/features/core/userGroup/entities/schema";

const BASE = "/api/admin/user-groups";

export type CreateUserGroupInput = Omit<z.input<typeof CreateUserGroupInputSchema>, "definition"> & { definition?: UserGroupDefinitionNode };
export type UpdateUserGroupInput = Omit<z.input<typeof UpdateUserGroupInputSchema>, "definition"> & { definition?: UserGroupDefinitionNode };
export type UpdateUserGroupExceptionsInput = z.input<typeof UpdateUserGroupExceptionsInputSchema>;
export type CreateStaticUserGroupInput = z.input<typeof CreateStaticUserGroupInputSchema>;
/** 静的グループの一員: 足す / 元から入れ替える / 外す */
export type UpdateStaticMembersInput = z.input<typeof UpdateStaticMembersInputSchema>;
/** 例外の人の側: include = 条件に合わなくても入れる / exclude = 条件に合っても外す */
export type UserGroupExceptionSide = "include" | "exclude";

export type {
  AdminStaticGroupResult,
  AdminStaticMembersRemoved,
  AdminUserGroupCount,
  AdminUserGroupCriteriaCatalog,
  AdminUserGroupDeleted,
  AdminUserGroupDetail,
  AdminUserGroupEstimate,
  AdminUserGroupMember,
  AdminUserGroupMemberPage,
  AdminUserGroupOption,
  AdminUserGroupPeopleApplied,
  AdminUserGroupPeoplePage,
  AdminUserGroupPerson,
  AdminUserGroupPage,
  AdminUserGroupRecompute,
  AdminUserGroupSampleUser,
  AdminUserGroupSummary,
  StaticMemberSource,
  UserGroupDefinitionNode,
  UserGroupKind,
  UserGroupStatus,
};

const one = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** 一覧(新しい順。kind で絞る、status 既定 active) */
export async function listUserGroups(
  params: { kind?: string; status?: string; cursor?: string | null; limit?: number } = {},
): Promise<AdminUserGroupPage> {
  try {
    const res = await axios.get<AdminUserGroupPage>(BASE, {
      params: { kind: params.kind || undefined, status: params.status || undefined, cursor: params.cursor ?? undefined, limit: params.limit },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "グループの一覧の取得に失敗しました");
  }
}

/** 1 件(元の定義・heavy・注意・例外の人数) */
export async function getUserGroup(id: string): Promise<AdminUserGroupDetail> {
  try {
    const res = await axios.get<AdminUserGroupDetail>(one(id));
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "グループの取得に失敗しました");
  }
}

/** 条件の部品の一覧と選択肢(ロール・状態・タグ・静的グループ)・種類 */
export async function getUserGroupCriteria(): Promise<AdminUserGroupCriteriaCatalog> {
  try {
    const res = await axios.get<AdminUserGroupCriteriaCatalog>(`${BASE}/criteria`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "条件の部品の取得に失敗しました");
  }
}

/** 作る(動的・定期計算 = 定義つき。静的は createStaticUserGroup) */
export async function createUserGroup(input: CreateUserGroupInput): Promise<AdminUserGroupDetail> {
  try {
    const res = await axios.post<AdminUserGroupDetail>(BASE, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "グループを作れませんでした");
  }
}

/** 直す(変えた欄だけ。種類は動的 ⇄ 定期計算だけ) */
export async function updateUserGroup(id: string, input: UpdateUserGroupInput): Promise<AdminUserGroupDetail> {
  try {
    const res = await axios.patch<AdminUserGroupDetail>(one(id), input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "グループを保存できませんでした");
  }
}

/** アーカイブしたグループを使用中に戻す */
export async function restoreUserGroup(id: string): Promise<AdminUserGroupDetail> {
  try {
    const res = await axios.post<AdminUserGroupDetail>(`${one(id)}/restore`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "使用中に戻せませんでした");
  }
}

/** 保管(一覧の既定と選択肢に出さない) */
export async function archiveUserGroup(id: string): Promise<AdminUserGroupDetail> {
  try {
    const res = await axios.post<AdminUserGroupDetail>(`${one(id)}/archive`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "保管できませんでした");
  }
}

/** 人を探す(D101)。対象(一員 / 入れる人 / 外す人)に入っているか・例外の反対側か の印つき、カーソル */
export async function searchUserGroupPeople(
  id: string,
  params: { target: "members" | "include" | "exclude"; q?: string; cursor?: string | null; limit?: number },
): Promise<AdminUserGroupPeoplePage> {
  try {
    const res = await axios.get<AdminUserGroupPeoplePage>(`${one(id)}/people-search`, {
      params: { target: params.target, q: params.q || undefined, cursor: params.cursor ?? undefined, limit: params.limit },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "ユーザーを検索できませんでした");
  }
}

/** 人の足し外しを 1 回で(D101)。例外の片側へ足した人は反対側から外れる */
export async function applyUserGroupPeople(
  id: string,
  input: { target: "members" | "include" | "exclude"; add: string[]; remove: string[] },
): Promise<AdminUserGroupPeopleApplied> {
  try {
    const res = await axios.post<AdminUserGroupPeopleApplied>(`${one(id)}/people-apply`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "変更を適用できませんでした");
  }
}

/** 削除(D92)。使われている(削除していない送信の宛先・ほかのグループの条件)と 409 で理由の文 */
export async function deleteUserGroup(id: string): Promise<AdminUserGroupDeleted> {
  try {
    const res = await axios.delete<AdminUserGroupDeleted>(one(id));
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "グループを削除できませんでした");
  }
}

/** 人数の見込みと試しの一覧(保存しない定義 { definition } か保存したグループ { groupId })。時間の上限は 503 */
export async function estimateUserGroup(
  input: { definition: UserGroupDefinitionNode } | { groupId: string },
): Promise<AdminUserGroupEstimate> {
  try {
    const res = await axios.post<AdminUserGroupEstimate>(`${BASE}/estimate`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "人数の見込みを出せませんでした");
  }
}

/** 例外の人を足す・外す(動的・定期計算だけ) */
export async function updateUserGroupExceptions(id: string, input: UpdateUserGroupExceptionsInput): Promise<AdminUserGroupDetail> {
  try {
    const res = await axios.put<AdminUserGroupDetail>(`${one(id)}/exceptions`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "例外の人を変えられませんでした");
  }
}

/** 例外の人の一覧(側ごと、カーソル) */
export async function listUserGroupExceptions(
  id: string,
  params: { side: UserGroupExceptionSide; cursor?: string | null; limit?: number; q?: string },
): Promise<AdminUserGroupMemberPage> {
  try {
    const res = await axios.get<AdminUserGroupMemberPage>(`${one(id)}/exceptions`, {
      params: { side: params.side, cursor: params.cursor ?? undefined, limit: params.limit, q: params.q || undefined },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "例外の人の取得に失敗しました");
  }
}

/** 静的グループを作る(一員の元つき)。members.status が incomplete なら updateStaticMembers の replace を同じ元で送り直す */
export async function createStaticUserGroup(input: CreateStaticUserGroupInput): Promise<AdminStaticGroupResult> {
  try {
    const res = await axios.post<AdminStaticGroupResult>(`${BASE}/static`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "固定のグループを作れませんでした");
  }
}

/** 静的グループの一員を足す・入れ替える(incomplete なら同じ body で送り直すと続きから)・外す */
export async function updateStaticMembers(
  id: string,
  input: UpdateStaticMembersInput,
): Promise<AdminStaticGroupResult | AdminStaticMembersRemoved> {
  try {
    const res = await axios.post<AdminStaticGroupResult | AdminStaticMembersRemoved>(`${one(id)}/members`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "一員を変えられませんでした");
  }
}

/** 静的グループの一員の一覧(表示名、カーソル) */
export async function listStaticMembers(
  id: string,
  params: { cursor?: string | null; limit?: number; q?: string } = {},
): Promise<AdminUserGroupMemberPage> {
  try {
    const res = await axios.get<AdminUserGroupMemberPage>(`${one(id)}/members`, {
      params: { cursor: params.cursor ?? undefined, limit: params.limit, q: params.q || undefined },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "一員の取得に失敗しました");
  }
}
