// src/features/core/userActionLog/constants/index.ts

export const USER_ACTION_TYPES = [
  "admin_status_change",
  "admin_profile_update",
  "admin_soft_delete",
  "admin_hard_delete",
  "user_preregister",
  "user_register",
  "user_pause",
  "user_reactivate",
  "user_withdraw",
  "user_rejoin",
  "other",
] as const;

export type UserActionType = (typeof USER_ACTION_TYPES)[number];

export const USER_ACTION_TYPE_LABELS: Record<UserActionType, string> = {
  admin_status_change: "ステータス変更",
  admin_profile_update: "プロフィール更新",
  admin_soft_delete: "論理削除",
  admin_hard_delete: "物理削除",
  user_preregister: "仮登録",
  user_register: "本登録",
  user_pause: "休会",
  user_reactivate: "復帰",
  user_withdraw: "退会",
  user_rejoin: "再入会",
  other: "その他",
};

export const USER_ACTION_ACTOR_TYPES = ["system", "admin", "user"] as const;

export type UserActionActorType = (typeof USER_ACTION_ACTOR_TYPES)[number];

export const USER_ACTION_ACTOR_TYPE_LABELS: Record<UserActionActorType, string> = {
  system: "システム",
  admin: "管理者",
  user: "ユーザー",
};
