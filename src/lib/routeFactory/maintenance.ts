// src/lib/routeFactory/maintenance.ts
//
// メンテナンス中に書き込みの経路を止める判定（全 Factory の土台 makeRouteCore が使う）。
// 期間の判定とバイパスの判定は lib が持たない: wiring が RouteMaintenanceDeps で渡す（src/wiring/apiRoute.ts）。
// 止める物: 書き込みのメソッド（POST・PUT・PATCH・DELETE）。GET・HEAD・OPTIONS は期間を読まずに通す。
// 通す物: ルートの設定の maintenance: "pass"（決済の完了の通知・ログイン等、持ち主が宣言する）と、canBypass が true の利用者。

import { NextResponse } from "next/server";

import type { RouteMaintenanceDeps, RouteUserBase, RouteUserDeps } from "./deps";
import { resolveRouteUser } from "./routeUser";

/** 止めた応答の code（クライアントはこの code でメンテナンスと分かる） */
export const MAINTENANCE_CODE = "maintenance";

/** 止めた応答の message */
const MAINTENANCE_MESSAGE = "メンテナンス中のため、この操作は現在できません。";

/** メンテナンス中に止めるメソッド */
const WRITE_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 土台が使う形: 期間か・この要求の利用者が通るか（利用者は要るときだけ解く） */
export type RouteMaintenanceCheck = {
  isActive: () => Promise<boolean>;
  canBypass: () => Promise<boolean>;
};

/**
 * 口と利用者の束を結ぶ。利用者は authorize と同じ resolveUser（持ち主がリクエスト内で 1 回にする）で解く。
 * 解けない（DB 障害）ときは RouteUserUnavailableError（503 route_user_unavailable）になる
 */
export function bindMaintenance<TUser extends RouteUserBase<TStatus>, TStatus extends string>(
  maintenance: RouteMaintenanceDeps<TUser> | undefined,
  userDeps: RouteUserDeps<TUser, TStatus>,
): RouteMaintenanceCheck | undefined {
  if (!maintenance) return undefined;
  return {
    isActive: () => maintenance.isActive(),
    canBypass: async () => {
      const resolved = await resolveRouteUser(userDeps);
      // ページの守り（proxy）と同じく、利用できない status の利用者はバイパスに使わない
      const user = resolved && userDeps.availableStatuses.includes(resolved.status) ? resolved : null;
      return maintenance.canBypass(user);
    },
  };
}

/**
 * この要求を止めるなら 503 の応答、通すなら null。
 * - check 無し・"pass" の宣言・書き込み以外のメソッド: 期間を読まずに null
 * - 期間の外: null
 * - userResolution "skip" のルート: 利用者を解かない（バイパス無し）
 */
export async function maintenanceDenial(
  check: RouteMaintenanceCheck | undefined,
  req: Request,
  declaration: "pass" | undefined,
  userResolution: "skip" | undefined,
): Promise<Response | null> {
  if (!check || declaration === "pass" || !WRITE_METHODS.has(req.method.toUpperCase())) return null;
  if (!(await check.isActive())) return null;
  if (userResolution !== "skip" && (await check.canBypass())) return null;
  return NextResponse.json({ message: MAINTENANCE_MESSAGE, code: MAINTENANCE_CODE }, { status: 503 });
}
