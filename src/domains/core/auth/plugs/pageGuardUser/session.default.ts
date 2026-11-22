// src/domains/core/auth/plugs/pageGuardUser/session.default.ts
//
// 点 pageGuardUser(ページの守りの利用者の束、ちょうど 1 つ、宣言 src/lib/pageGuard/extensionPoints.ts)に差す上流の既定。
// 常設の auth が差す(D53)。呼び手は隣の 1 行スイッチ ./session.ts(fork は差替点 authPageGuardUser で ./session.replace.ts に替える)。
// 結ぶのは生成物 src/wiring/pageGuard.ts(defineRootGuard)。guard.ts・loader・業務コードは直接使わない(loader は ctx.user を使う)

import type { SessionUser } from "@/domains/core/auth/entities/session";
import { evaluateApiAccessRule } from "@/domains/core/auth/services/server/apiAccess";
import { getRequestPathname, hasUserForAccess } from "@/domains/core/auth/services/server/authorization";
import { getSessionUser } from "@/domains/core/auth/services/server/session/getSessionUser";
import { USER_AVAILABLE_STATUSES } from "@/domains/core/user/constants";
import type { UserStatus } from "@/domains/core/user/types";
import type { PageGuardUserPlug } from "@/lib/pageGuard/points";

export const plug: PageGuardUserPlug<SessionUser> = {
  deps: {
    // DB 同期(React cache でリクエスト内 1 回。AuthSessionProvider・API の Factory と共有)
    resolveUser: getSessionUser,
    evaluateAccess: (rule, user, { allowStatuses }) =>
      evaluateApiAccessRule(rule, user, { allowStatuses: allowStatuses as readonly UserStatus[] | undefined }),
    availableStatuses: USER_AVAILABLE_STATUSES,
    getRequestPathname,
    // setup 誘導の判定(範囲の access を満たしうる利用者が 1 人以上いるか。真偽値だけ)
    hasUserForAccess,
  },
};
