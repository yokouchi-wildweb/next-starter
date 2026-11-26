// src/domains/core/userGroup/entities/userGroupVersion/schema.ts

/** 定期計算の版の状態: computing = 計算中 / ready = 計算し終えた(今の版にできる)/ failed = 失敗(誤りを持ち返す) */
export const USER_GROUP_VERSION_STATUSES = ["computing", "ready", "failed"] as const;
export type UserGroupVersionStatus = (typeof USER_GROUP_VERSION_STATUSES)[number];
