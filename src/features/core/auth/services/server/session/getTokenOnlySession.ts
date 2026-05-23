// src/features/core/auth/services/server/session/getTokenOnlySession.ts

import { cookies } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { resolveSessionUserFromTokenOnly } from "./token";

/**
 * 現在のリクエスト Cookie から、JWT クレームのみで SessionUser を取得する低レベル API。
 *
 * 戻り値の status / role / isDemo / name 等は JWT 発行時点のスナップショットであり、
 * DB の現在値とは乖離し得る (stale)。**認可判定には絶対に使わないこと。**
 * 認可は必ず getSessionUser() / authGuard() (= DB と同期される) 経由で行う。
 *
 * 想定する用途:
 * - 監査ログの actor_id (= userId) 抽出 — userId は JWT で十分
 * - 全 API ルート基盤でのデモユーザー判定 (isDemo) — stale 化リスクが極小
 * - その他、認可とは無関係でリクエストごとに DB を引くコストを払えない高頻度処理
 */
export async function getTokenOnlySession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);

  if (!token) {
    return null;
  }

  return resolveSessionUserFromTokenOnly(token);
}
