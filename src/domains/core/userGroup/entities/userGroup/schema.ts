// src/domains/core/userGroup/entities/userGroup/schema.ts

/** グループの種類(D103): dynamic = 条件を保存し使う時に引く / scheduled = cron が計算した版を使う / static = 利用者 id の並び */
export const USER_GROUP_KINDS = ["dynamic", "scheduled", "static"] as const;
export type UserGroupKind = (typeof USER_GROUP_KINDS)[number];
/** グループの状態: active = 使える / archived = 残すが選択肢に出さず、新しい宛先・条件に使えない */
export const USER_GROUP_STATUSES = ["active", "archived"] as const;
export type UserGroupStatus = (typeof USER_GROUP_STATUSES)[number];
