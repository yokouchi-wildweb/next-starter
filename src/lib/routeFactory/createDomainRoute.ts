// src/lib/apiRoute/createDomainRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { createApiRoute, type OperationType, type ApiRouteContext } from "./createApiRoute";
import { serviceRegistry } from "@/registry/serviceRegistry";

/**
 * ドメインルートの設定
 */
export type DomainRouteConfig<TService> = {
  /** 操作名（ログ・デバッグ用） */
  operation: string;
  /** 操作の種類 */
  operationType: OperationType;
  /** サービスが特定のメソッドをサポートしているか確認 */
  supports?: keyof TService | Array<keyof TService>;
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
    },
    async (req, ctx) => {
      const { domain } = ctx.params;
      const service = services[domain] as TService | undefined;

      if (!service) {
        return new NextResponse("Not Found", { status: 404 });
      }

      if (!ensureSupports(service, config.supports)) {
        return new NextResponse("Not Found", { status: 404 });
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
