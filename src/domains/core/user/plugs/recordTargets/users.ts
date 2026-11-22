// src/domains/core/user/plugs/recordTargets/users.ts
//
// 記録の宛先(recordTargets、D192・D217): 利用者の一覧で選んだ利用者 → その利用者本人(1 人 1 件、記録から埋める値なし)。
// 送れる連絡定義は上流では空。fork は隣の users.override.ts(recordTargetOverride の messages)で並べるか、自分のドメインに項目を置く。
// user は門の外のドメイン(常に開)なので enabled は持たない

import { and, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserTable } from "@/domains/core/user/entities/drizzle";

import type { MessageRecordTarget } from "@/lib/messaging";

export const recordTarget: MessageRecordTarget = {
  key: "user.users",
  label: "利用者",
  messages: [],
  async resolveRecipients(recordIds) {
    if (recordIds.length === 0) return [];
    // 記録 = 利用者の id。無い・削除済みの利用者は飛ばす(送ってよいかは送る口が状態と好みで決める)
    const rows = await db
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(and(inArray(UserTable.id, [...new Set(recordIds)]), isNull(UserTable.deletedAt)));
    return rows.map((row) => ({ userId: row.id, vars: {}, recordIds: [row.id] }));
  },
};
