// src/lib/routeFactory/enforceAccess.ts
// 汎用ルート / カスタムルート共通のアクセスルール強制

import { NextResponse } from "next/server";

import { evaluateApiAccessRule } from "@/features/core/auth/services/server/apiAccess";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import type { DomainApiAccessRule } from "@/lib/domain";

/**
 * アクセスルールを評価し、拒否時は対応する NextResponse を返す（許可時は null）。
 *
 * ロール判定は DB 同期される getSessionUser を使う（token-only セッションでは
 * ロール剥奪・利用停止が反映されないため）。public / none はセッション取得を避ける。
 */
export async function enforceAccessRule(
  rule: DomainApiAccessRule,
): Promise<NextResponse | null> {
  const requiresSession = rule !== "public" && rule !== "none";
  const sessionUser = requiresSession ? await getSessionUser() : null;
  const decision = evaluateApiAccessRule(rule, sessionUser);

  if (decision === "not_found") {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (decision === "unauthenticated") {
    return NextResponse.json({ message: "認証が必要です。" }, { status: 401 });
  }
  if (decision === "forbidden") {
    return NextResponse.json(
      { message: "この操作を行う権限がありません。" },
      { status: 403 },
    );
  }
  return null;
}
