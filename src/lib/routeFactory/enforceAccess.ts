// src/lib/routeFactory/enforceAccess.ts
// 汎用ルート / カスタムルート共通のアクセスルール強制

import { NextResponse } from "next/server";

import type { DomainApiAccessRule } from "@/lib/domain";

import type { RouteAccessDecision, RouteUserBase, RouteUserDeps } from "./deps";

/**
 * 拒否の応答 body に載せる識別情報。クライアントが「どのドメイン・操作が拒否されたか」を
 * 観測できるようにする（認可ルールの中身は出さない）。
 */
export type AccessDenialContext = {
  /** 汎用ドメインルートのドメイン名（camelCase） */
  domain?: string;
  /** アクセス制御上の操作名（crudOp など） */
  operation?: string;
};

/** enforceAccessRule の追加の条件 */
export type EnforceAccessOptions<TStatus extends string = string> = AccessDenialContext & {
  /** 通過を許可するユーザーステータス（省略時は既定の利用可能 status だけ） */
  allowStatuses?: readonly TStatus[];
};

/**
 * 評価結果を応答にする（許可なら null）。
 * 404 は text/plain（存在を隠す）、401 / 403 は JSON に code（"unauthenticated" / "forbidden"）と拒否の識別情報。
 */
export function accessDenialResponse(
  decision: RouteAccessDecision,
  context: AccessDenialContext = {},
): NextResponse | null {
  if (decision === "not_found") {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (decision === "unauthenticated") {
    return NextResponse.json(
      { message: "認証が必要です。", code: "unauthenticated", ...context },
      { status: 401 },
    );
  }
  if (decision === "forbidden") {
    return NextResponse.json(
      { message: "この操作を行う権限がありません。", code: "forbidden", ...context },
      { status: 403 },
    );
  }
  return null;
}

/**
 * アクセスルールを Factory が解いた利用者（ctx.user）と照合し、拒否時は応答を返す（許可時は null）。
 * 主体は引き直さない（ルートの門に加えて掛ける追加の門。例: ドメインごとの export / import の access）。
 */
export type EnforceAccessRule<TUser = RouteUserBase, TStatus extends string = string> = (
  rule: DomainApiAccessRule,
  user: TUser | null,
  options?: EnforceAccessOptions<TStatus>,
) => Promise<NextResponse | null>;

/** access の評価の束を結んだ enforceAccessRule を作る */
export function makeEnforceAccessRule<TUser extends RouteUserBase<TStatus>, TStatus extends string>(
  deps: RouteUserDeps<TUser, TStatus>,
): EnforceAccessRule<TUser, TStatus> {
  return async (rule, user, options = {}) => {
    const { allowStatuses, ...context } = options;
    return accessDenialResponse(deps.evaluateAccess(rule, user, { allowStatuses }), context);
  };
}
