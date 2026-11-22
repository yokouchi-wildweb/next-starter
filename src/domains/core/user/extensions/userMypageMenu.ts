// 生成物・編集不可: pnpm generate extensions が src/domains/core/user/extensionPoints.ts から生成する
// userMypageMenu: 差す側の <ドメイン>/plugs/userMypageMenu/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const item(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の hidden・order・title・description・icon・variant・pendingTitle を重ねる)

import type { MypageMenuItem } from "@/domains/core/user/types";

import { item as userMypageMenu_user_account } from "@/domains/core/user/plugs/userMypageMenu/account";
import { item as userMypageMenu_user_invite } from "@/domains/core/user/plugs/userMypageMenu/invite";
import { item as userMypageMenu_user_logout } from "@/domains/core/user/plugs/userMypageMenu/logout";
import { item as userMypageMenu_user_notifications } from "@/domains/core/user/plugs/userMypageMenu/notifications";
import { item as userMypageMenu_user_other } from "@/domains/core/user/plugs/userMypageMenu/other";

export const userMypageMenu: { domain: string | null; name: string; requires: readonly string[]; plug: MypageMenuItem }[] = [
  { domain: "user", name: "account", requires: [], plug: userMypageMenu_user_account },
  { domain: "user", name: "invite", requires: [], plug: userMypageMenu_user_invite },
  { domain: "user", name: "logout", requires: [], plug: userMypageMenu_user_logout },
  { domain: "user", name: "notifications", requires: [], plug: userMypageMenu_user_notifications },
  { domain: "user", name: "other", requires: [], plug: userMypageMenu_user_other },
];
