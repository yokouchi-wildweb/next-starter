// src/lib/pageGuard/index.ts
// 汎用版。値を import してよいのは src/wiring/** だけ(guard.ts は root の範囲を @/wiring/pageGuard から作る)。型は誰でも可

export { createPageGuard } from "./createPageGuard";
export type {
  LoaderKeyValue,
  PageAccess,
  PageAccessDecision,
  PageGuard,
  PageGuardDeps,
  PageGuardPolicy,
  PageGuardUser,
  PageLoaderConfig,
  PageRangeAccess,
} from "./types";
