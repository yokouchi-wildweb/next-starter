// src/lib/backends/index.ts
// 入口 "."(client でも server でも読める、node の API を読まない)。名前を 1 つずつ書いて出す

export { createNoneAdapter, BackendNoneSelectedError } from "./none";
export type { CreateNoneAdapterOptions } from "./none";
export { createBackendOverride } from "./override";
export { backendPrices } from "./prices";
export { createBackendStatusTask } from "./statusTask";
export type { BackendStatusTask, CreateBackendStatusTaskOptions } from "./statusTask";
export type { BackendPriceRow } from "./prices";
export type { BackendOverride } from "./override";
export {
  FAKE_IMPLEMENTATION,
  NONE_IMPLEMENTATION,
  RESERVED_IMPLEMENTATION_NAMES,
  UNSELECTABLE_IMPLEMENTATION_NAMES,
} from "./reserved";
export type {
  BackendAdapter,
  BackendStatus,
  BackendCapabilityItem,
  BackendCompat,
  BackendDeclaration,
  BackendEnv,
  BackendRequirements,
  BillingKind,
  BillingScale,
  CapabilityName,
  IsConfiguredResult,
} from "./types";
