// src/lib/apiRoute/createDomainRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { createApiRoute, type OperationType, type ApiRouteContext } from "./createApiRoute";
import { enforceAccessRule } from "./enforceAccess";
import { resolveAccessRule, type DomainApiOperation } from "@/lib/domain";
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
      // 認可は createDomainRoute がドメインごとに registry の access から動的に強制する。
      // createApiRoute 側の認可はスキップさせる。
      access: "custom",
    },
    async (req, ctx) => {
      const { domain } = ctx.params;
      // ドメイン名を正規化（snake_case → camelCase）
      const normalizedDomain = toCamelCase(domain);
      const entry = services[normalizedDomain];

      if (!entry) {
        return new NextResponse("Not Found", { status: 404 });
      }

      const service = entry.service as TService;

      if (!ensureSupports(service, config.supports)) {
        return new NextResponse("Not Found", { status: 404 });
      }

      // ===== アクセス制御（serviceRegistry エントリの access 宣言に基づく） =====
      // access が当該操作をカバーしない場合は fail-closed（admin カテゴリのみ）に倒れる。
      const rule = resolveAccessRule(entry.access, config.crudOp, config.operationType);
      const denied = await enforceAccessRule(rule);
      if (denied) return denied;

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
