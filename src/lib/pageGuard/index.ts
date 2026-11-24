// src/lib/pageGuard/index.ts
// 汎用版。値を import してよいのは src/wiring/** だけ(guard.ts は root の範囲を生成物 @/wiring/pageGuard から作る)。型は誰でも可

export { createPageGuard } from "./createPageGuard";
export { wirePageGuard } from "./wire";
export type { GuardProps } from "./guardBoundary";
export type { AnyPageGuardUserPlug, GuardUserOf, PageGuardUserPlug } from "./plugs";
export type {
  LoaderKeyValue,
  PageAccess,
  PageAccessDecision,
  PageGuard,
  PageGuardDeps,
  PageGuardPolicy,
  PageGuardUser,
  PageLoaderConfig,
  PageLoaderContext,
  PageRangeAccess,
} from "./types";
