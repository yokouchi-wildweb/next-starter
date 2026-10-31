// src/lib/routeFactory/createDomainRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { resolveAccessRule, type DomainCrudOperation, type DomainRegistry } from "@/lib/domain";
import { toCamelCase } from "@/utils/stringCase.mjs";

import type { OperationType, ApiRouteContext, RouteCore } from "./createApiRoute";
import type { RouteUserBase, RouteUserDeps } from "./deps";
import { accessDenialResponse } from "./enforceAccess";

/**
 * ドメインルートの設定
 */
export type DomainRouteConfig<TService, TStatus extends string = string> = {
  /** 操作名（ログ・デバッグ用） */
  operation: string;
  /** 操作の種類 */
  operationType: OperationType;
  /**
   * CRUD 操作名（アクセス制御用）
   * domain.json の apiAccess.operations のキーと対応する（管理データ操作 truncateAll / export / import は汎用ルートに無い）
   */
  crudOp: DomainCrudOperation;
  /** サービスが特定のメソッドをサポートしているか確認 */
  supports?: keyof TService | Array<keyof TService>;
  /**
   * デモユーザーの場合にDB操作をスキップするか
   * - undefined: operationType === "write" の場合に自動スキップ
   * - true: 強制的にスキップ
   * - false: スキップしない（デモでも実行を許可）
   */
  skipForDemo?: boolean;
  /**
   * 通過を許可するユーザーステータス（省略時は利用可能な status だけ）。createApiRoute と同じ語彙・fail-closed
   */
  allowStatuses?: readonly TStatus[];
};

/**
 * ドメインルートハンドラーのコンテキスト
 */
export type DomainRouteContext<TService, TParams, TUser = RouteUserBase> = ApiRouteContext<TParams, TUser | null> & {
  service: TService;
  domain: string;
};

/**
 * ドメインルートハンドラーの型
 */
export type DomainRouteHandler<TService, TParams, TResult = unknown, TUser = RouteUserBase> = (
  req: NextRequest,
  ctx: DomainRouteContext<TService, TParams, TUser>,
) => Promise<TResult> | TResult;

/**
 * ドメインパラメータの基本型
 */
type DomainParams = { domain: string };
type DomainIdParams = { domain: string; id: string };

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
 * ドメインCRUD用のファクトリーを作る（利用者の束・登録表・土台を結ぶ）。
 *
 * 認可は URL のドメイン名から登録表の行を引き、domainEntry.ts の access でドメインごとに強制する。
 * ctx.user は Factory が解いた利用者（access が "public" の操作では null 可）。
 */
export function makeDomainRoutes<TUser extends RouteUserBase<TStatus>, TStatus extends string>(
  deps: RouteUserDeps<TUser, TStatus>,
  registry: DomainRegistry,
  runRoute: RouteCore,
) {
  function createDomainRoute<
    TService = any,
    TParams extends DomainParams = DomainParams,
    TResult = unknown,
  >(
    config: DomainRouteConfig<TService, TStatus>,
    handler: DomainRouteHandler<TService, TParams, TResult, TUser>,
  ) {
    const { crudOp, supports, allowStatuses, ...baseConfig } = config;
    return runRoute<TParams, { service: TService; user: TUser | null }>(
      baseConfig,
      async (_req, params) => {
        const { domain } = params;
        // ドメイン名を正規化（snake_case → camelCase）
        const normalizedDomain = toCamelCase(domain);
        const entry = Object.prototype.hasOwnProperty.call(registry, normalizedDomain)
          ? registry[normalizedDomain]
          : undefined;

        if (!entry) {
          return new NextResponse("Not Found", { status: 404 });
        }

        // ===== アクセス制御（domainEntry.ts の access 宣言に基づく。登録表 serviceRegistry が実行時ソース） =====
        // access が当該操作をカバーしない場合は fail-closed（admin カテゴリのみ）に倒れる。
        // サービスの読み込み（遅延 import）より先に判定し、拒否される要求でサービスを読み込まない。
        const rule = resolveAccessRule(entry.access, crudOp, config.operationType);
        const resolved = await deps.resolveUser();
        const denied = accessDenialResponse(deps.evaluateAccess(rule, resolved, { allowStatuses }), {
          domain: normalizedDomain,
          operation: crudOp,
        });
        if (denied) return denied;
        // "public" の操作では利用できない status の利用者を渡さない（createApiRoute の "public" と同じ）
        const allowed = allowStatuses ?? deps.availableStatuses;
        const user = resolved && allowed.includes(resolved.status) ? resolved : null;

        const service = (await entry.service()) as TService;

        if (!ensureSupports(service, supports)) {
          return new NextResponse("Not Found", { status: 404 });
        }
        return { service, user };
      },
      async (req, base, { service, user }) => {
        const domainCtx: DomainRouteContext<TService, TParams, TUser> = {
          ...base,
          user,
          service,
          domain: base.params.domain,
        };
        return handler(req, domainCtx);
      },
    );
  }

  /**
   * IDパラメータ付きドメインルート用のファクトリー
   */
  function createDomainIdRoute<TService = any, TResult = unknown>(
    config: DomainRouteConfig<TService, TStatus>,
    handler: DomainRouteHandler<TService, DomainIdParams, TResult, TUser>,
  ) {
    return createDomainRoute<TService, DomainIdParams, TResult>(config, handler);
  }

  return { createDomainRoute, createDomainIdRoute };
}
