// src/features/core/auth/services/server/pageGuardUserDeps.ts
//
// ページの守り(lib/pageGuard)に差し込む利用者の束。認証の持ち主(auth)がここで 1 つだけ出す。
// 結ぶのは src/wiring/pageGuard.ts。guard.ts・loader・業務コードは直接使わない(loader は ctx.user を使う)。
// setup 誘導の判定(hasUserForAccess)は束に入れず、wiring が guard の作り手へ渡す。

import type { SessionUser } from "@/features/core/auth/entities/session";
import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";
import type { UserStatus } from "@/features/core/user/types";
import type { PageGuardDeps } from "@/lib/pageGuard";

import { evaluateApiAccessRule } from "./apiAccess";
import { getRequestPathname } from "./authorization";
import { getSessionUser } from "./session/getSessionUser";

export const pageGuardUserDeps: Omit<PageGuardDeps<SessionUser>, "hasUserForAccess"> = {
  // DB 同期(React cache でリクエスト内 1 回。AuthSessionProvider・API の Factory と共有)
  resolveUser: getSessionUser,
  evaluateAccess: (rule, user, { allowStatuses }) =>
    evaluateApiAccessRule(rule, user, { allowStatuses: allowStatuses as readonly UserStatus[] | undefined }),
  availableStatuses: USER_AVAILABLE_STATUSES,
  getRequestPathname,
};
