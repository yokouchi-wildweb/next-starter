// 生成物・編集不可: pnpm generate extensions が src/domains/core/userGroup/extensionPoints.ts から生成する
// userGroupCriteria: 差す側の <ドメイン>/plugs/userGroupCriteria/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const criterion(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の enabled・label・description を重ねる)

import type { UserGroupCriterion } from "@/domains/userGroup/types";

import { criterion as userGroupCriteria_userGroup_hasTag } from "@/domains/core/userGroup/plugs/userGroupCriteria/hasTag";
import { criterion as userGroupCriteria_userGroup_inStaticGroup } from "@/domains/core/userGroup/plugs/userGroupCriteria/inStaticGroup";
import { criterion as userGroupCriteria_userGroup_lastLoginPeriod } from "@/domains/core/userGroup/plugs/userGroupCriteria/lastLoginPeriod";
import { criterion as userGroupCriteria_userGroup_purchaseTotal } from "@/domains/core/userGroup/plugs/userGroupCriteria/purchaseTotal";
import { criterion as userGroupCriteria_userGroup_signupPeriod } from "@/domains/core/userGroup/plugs/userGroupCriteria/signupPeriod";

export const userGroupCriteria: { domain: string | null; name: string; requires: readonly string[]; plug: UserGroupCriterion }[] = [
  { domain: "userGroup", name: "hasTag", requires: [], plug: userGroupCriteria_userGroup_hasTag },
  { domain: "userGroup", name: "inStaticGroup", requires: [], plug: userGroupCriteria_userGroup_inStaticGroup },
  { domain: "userGroup", name: "lastLoginPeriod", requires: [], plug: userGroupCriteria_userGroup_lastLoginPeriod },
  { domain: "userGroup", name: "purchaseTotal", requires: [], plug: userGroupCriteria_userGroup_purchaseTotal },
  { domain: "userGroup", name: "signupPeriod", requires: [], plug: userGroupCriteria_userGroup_signupPeriod },
];
