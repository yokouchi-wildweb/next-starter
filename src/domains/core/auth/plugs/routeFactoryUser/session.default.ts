// src/domains/core/auth/plugs/routeFactoryUser/session.default.ts
//
// 点 routeFactoryUser(API ルートの Factory の利用者の解き方、ちょうど 1 つ、宣言 src/lib/routeFactory/extensionPoints.ts)に差す上流の既定。
// 常設の auth が差す(D53)。呼び手は隣の 1 行スイッチ ./session.ts(fork は差替点 authRouteFactoryUser で ./session.replace.ts に替える)。
// 結ぶのは src/wiring/apiRoute.ts(生成された一覧 src/wiring/routeFactory.ts ごし)。route・業務コードは直接使わない(ctx.user を使う)

import type { SessionUser } from "@/domains/core/auth/entities/session";
import type { UserStatus } from "@/domains/core/user/types";
import { USER_AVAILABLE_STATUSES } from "@/domains/core/user/constants";

import { evaluateApiAccessRule } from "../../services/server/apiAccess";
import { getSessionUserForRoute } from "../../services/server/session/getSessionUser";
import { getTokenOnlySession } from "../../services/server/session/getTokenOnlySession";
import type { RouteUserPlug } from "@/lib/routeFactory/points";

export const plug: RouteUserPlug<SessionUser, UserStatus> = {
  deps: {
    // DB 同期（React cache でリクエスト内 1 回、getSessionUser と共有）。null = 利用者なし、
    // DB に届かないときは throw（Factory が 503 route_user_unavailable にする。401 にも JWT のクレームにも落とさない）
    resolveUser: getSessionUserForRoute,
    // JWT のクレームだけ（監査の actor・デモ判定の内部用。認可には使わない）
    resolveTokenSession: getTokenOnlySession,
    evaluateAccess: evaluateApiAccessRule,
    availableStatuses: USER_AVAILABLE_STATUSES,
  },
};
