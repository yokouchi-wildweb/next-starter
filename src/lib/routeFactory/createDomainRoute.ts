// src/lib/apiRoute/createDomainRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { createApiRoute, type OperationType, type ApiRouteContext } from "./createApiRoute";
import { evaluateApiAccessRule } from "@/features/core/auth/services/server/apiAccess";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { resolveDomainApiAccessRule, type DomainApiOperation } from "@/lib/domain";
import { serviceRegistry } from "@/registry/serviceRegistry";
import { toCamelCase } from "@/utils/stringCase.mjs";

/**
 * ドメインルートの設定
 */
export type DomainRouteConfig<TService> = {
  /** 操作名（ログ・デバッグ用） */
  operation: string;
  /** 操作の種類 */
  operationType: OperationType;
  /**
   * CRUD 操作名（アクセス制御用）
   * domain.json の apiAccess.operations のキーと対応する
   */
  crudOp: DomainApiOperation;
  /** サービスが特定のメソッドをサポートしているか確認 */
  supports?: keyof TService | Array<keyof TService>;
  /**
   * デモユーザーの場合にDB操作をスキップするか
   * - undefined: operationType === "write" の場合に自動スキップ
   * - true: 強制的にスキップ
   * - false: スキップしない（デモでも実行を許可）
   */
  skipForDemo?: boolean;
};

/**
 * ドメインルートハンドラーのコンテキスト
 */
export type DomainRouteContext<TService, TParams> = ApiRouteContext<TParams> & {
  service: TService;
  domain: string;
};

/**
 * ドメインルートハンドラーの型
 */
export type DomainRouteHandler<TService, TParams, TResult = unknown> = (
  req: NextRequest,
  ctx: DomainRouteContext<TService, TParams>,
) => Promise<TResult> | TResult;

/**
 * ドメインパラメータの基本型
 */
type DomainParams = { domain: string };
type DomainIdParams = { domain: string; id: string };

const services = serviceRegistry;

/**
 * サービスが指定されたメソッドをサポートしているか確認
 */
function ensureSupports<TService>(
  service: TService,
  supports?: DomainRouteConfig<TService>["supports"],
): boolean {
  if (!supports) return true;
  const methods = Array.isArray(supports) ? supports : [supports];
  return methods.every(
    (method) => typeof (service as Record<PropertyKey, unknown>)[method] === "function",
  );
}

/**
 * ドメインCRUD用のファクトリー
 *
 * createApiRouteを内部で使用し、ドメインサービスとの連携を追加する。
 */
export function createDomainRoute<
  TService = any,
  TParams extends DomainParams = DomainParams,
  TResult = unknown,
>(
  config: DomainRouteConfig<TService>,
  handler: DomainRouteHandler<TService, TParams, TResult>,
) {
  return createApiRoute<TParams, TResult | NextResponse>(
    {
      operation: config.operation,
      operationType: config.operationType,
      skipForDemo: config.skipForDemo,
    },
    async (req, ctx) => {
      const { domain } = ctx.params;
      // ドメイン名を正規化（snake_case → camelCase）
      const normalizedDomain = toCamelCase(domain);
      const service = services[normalizedDomain] as TService | undefined;

      if (!service) {
        return new NextResponse("Not Found", { status: 404 });
      }

      if (!ensureSupports(service, config.supports)) {
        return new NextResponse("Not Found", { status: 404 });
      }

      // ===== アクセス制御（domain.json の apiAccess 宣言に基づく） =====
      // 未宣言ドメインは fail-closed（admin カテゴリのみ）にフォールバックする。
      // ロール判定には DB 同期される getSessionUser を使う（token-only セッションでは
      // ロール剥奪・利用停止が反映されないため）。public の場合は DB 引きを避ける。
      const rule = resolveDomainApiAccessRule(domain, config.crudOp, config.operationType);
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

      const domainCtx: DomainRouteContext<TService, TParams> = {
        ...ctx,
        service,
        domain,
      };

      return handler(req, domainCtx);
    },
  );
}

/**
 * IDパラメータ付きドメインルート用のファクトリー
 */
export function createDomainIdRoute<TService = any, TResult = unknown>(
  config: DomainRouteConfig<TService>,
  handler: DomainRouteHandler<TService, DomainIdParams, TResult>,
) {
  return createDomainRoute<TService, DomainIdParams, TResult>(config, handler);
}
