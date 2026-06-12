// src/lib/apiRoute/index.ts

export {
  createApiRoute,
  type ApiRouteConfig,
  type ApiRouteContext,
  type OperationType,
  type RouteAccess,
} from "./createApiRoute";
export { enforceAccessRule } from "./enforceAccess";
export {
  createDomainRoute,
  createDomainIdRoute,
  type DomainRouteConfig,
  type DomainRouteContext,
} from "./createDomainRoute";
