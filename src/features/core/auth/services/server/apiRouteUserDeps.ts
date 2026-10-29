// src/features/core/auth/services/server/apiRouteUserDeps.ts
//
// API ルートの Factory（lib/routeFactory）に差し込む利用者の束。認証の持ち主（auth）がここで 1 つだけ出す。
// 結ぶのは src/wiring/apiRoute.ts。route・業務コードは直接使わない（ctx.user を使う）。

import type { RouteUserDeps } from "@/lib/routeFactory";
import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";

import { evaluateApiAccessRule } from "./apiAccess";
import { getSessionUser } from "./session/getSessionUser";
import { getTokenOnlySession } from "./session/getTokenOnlySession";

export const apiRouteUserDeps: RouteUserDeps = {
  // DB 同期（React cache でリクエスト内 1 回）。DB に届かないときは null（resolveSessionUser が整合性を優先）
  resolveUser: getSessionUser,
  // JWT のクレームだけ（監査の actor・デモ判定の内部用。認可には使わない）
  resolveTokenSession: getTokenOnlySession,
  evaluateAccess: evaluateApiAccessRule,
  availableStatuses: USER_AVAILABLE_STATUSES,
};
