// src/features/core/userGroup/services/server/admin/dto.ts
// 管理の API が返す形(表示名を先に。内部の鍵は値としてだけ持つ、D94)

import type { FieldConfig } from "@/components/Form/Field/types";
import type { InlineFieldGroup } from "@/components/Form/FieldRenderer/types";

import type { UserGroupDefinitionNode, UserGroupKind, UserGroupStatus } from "../../../entities/schema";
import type { ReplaceMembersResult } from "../writes";

export const USER_GROUP_KIND_LABELS: Record<UserGroupKind, string> = {
  dynamic: "自動で都度抽出",
  scheduled: "定期的に更新",
  static: "作成時に固定",
};

export const USER_GROUP_STATUS_LABELS: Record<UserGroupStatus, string> = {
  active: "使用中",
  archived: "アーカイブ",
};

/**
 * 人数: counted = 表から数えた(静的・定期計算の今の版)/ estimated = 動的を今数えた /
 * not_computed = 時間の上限で数えなかった(条件が重い・一覧の時間が尽きた)/ none = まだ数がない(定期計算の版が無い)
 */
export type AdminUserGroupCount = { value: number | null; state: "counted" | "estimated" | "not_computed" | "none" };

export type AdminUserGroupRecompute = {
  /** 間隔(分。null = 設定の既定) */
  intervalMinutes: number | null;
  defaultIntervalMinutes: number;
  /** 今の版を計算し終えた時刻 */
  lastComputedAt: string | null;
  /** 今の版より新しい失敗(無ければ null) */
  lastFailure: { at: string | null; reason: string | null } | null;
  /** 書きかけの版がある */
  computing: boolean;
};

export type AdminUserGroupSummary = {
  id: string;
  name: string;
  description: string | null;
  kind: UserGroupKind;
  kindLabel: string;
  status: UserGroupStatus;
  statusLabel: string;
  count: AdminUserGroupCount;
  /** 定期計算だけ */
  recompute: AdminUserGroupRecompute | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserGroupDetail = AdminUserGroupSummary & {
  /** 条件の定義の木(例外の包みを外した元の定義。静的は null) */
  definition: UserGroupDefinitionNode | null;
  /** heavy の部品を含むか */
  heavy: boolean;
  /** 画面に出す注意(重い条件の 1 人の確かめ・定期計算の反映の時期など) */
  notices: string[];
  /** 例外の人(動的・定期計算だけ。静的は null) */
  exceptions: { includeCount: number; excludeCount: number } | null;
};

export type AdminUserGroupPage = { items: AdminUserGroupSummary[]; nextCursor: string | null };

/** 試しの一覧の 1 人(id と表示名だけ。メールは返さない) */
export type AdminUserGroupSampleUser = { id: string; name: string | null };

/** 一員・例外の人の一覧の 1 人(id と表示名だけ) */
export type AdminUserGroupMember = { id: string; name: string | null };

/** 一員・例外の人の一覧(利用者 id の順の keyset。nextCursor = 次の頁、null = 終わり) */
export type AdminUserGroupMemberPage = { items: AdminUserGroupMember[]; nextCursor: string | null };

/** 静的グループから外した後の人数 */
export type AdminStaticMembersRemoved = { memberCount: number };

export type AdminUserGroupEstimate = {
  count: number;
  memberLimit: number;
  overLimit: boolean;
  heavy: boolean;
  sample: AdminUserGroupSampleUser[];
};

export type AdminStaticGroupResult = { group: AdminUserGroupDetail; members: ReplaceMembersResult | { status: "added"; added: number; skipped: number; memberCount: number } };

export type AdminUserGroupOption = { value: string; label: string };

/** 条件の部品の一覧(key は定義の木の値としてだけ使う。画面は label を出す) */
export type AdminUserGroupCriteriaCatalog = {
  criteria: { key: string; label: string; description: string | null; weight: "cheap" | "heavy"; weightLabel: string; fields: FieldConfig[]; inlineGroups: InlineFieldGroup[] }[];
  options: {
    tags: AdminUserGroupOption[];
    staticGroups: AdminUserGroupOption[];
  };
  kinds: AdminUserGroupOption[];
};
