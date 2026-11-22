// src/domains/core/userGroup/types/evaluation.ts
// 評価の口の型(count・isMember・listMemberIds・evaluate)

import type { UserGroupDefinitionNode } from "../entities/schema";

/** 数える相手: 保存したグループ(uuid)か、保存しないその場の定義 */
export type UserGroupTarget = { groupId: string } | { definition: UserGroupDefinitionNode };

export type UserGroupCount = {
  count: number;
  /** 設定の人数の上限 */
  memberLimit: number;
  /** 上限を超えている(止めるのは使う所: 送信の固定・静的グループへの書き込み) */
  overLimit: boolean;
};

export type UserGroupEvaluation = UserGroupCount & {
  /** 試しの一覧(利用者 id の昇順の先頭) */
  sampleUserIds: string[];
  /** heavy の部品を含む(1 人の確かめを拒む。定期計算にすれば使える) */
  heavy: boolean;
};

export type UserGroupMemberPage = { userIds: string[]; nextCursor: string | null };
