// src/lib/unsavedGuard/index.ts
// 未保存の編集の守り(入口はここ 1 つ。中のファイルを外から読まない)。仕組み・決めた手段と捨てた案: ./README.md
export { UnsavedGuardProvider, useLinkNavigateJudge, useRouter, useUnsavedGuard, useUnsavedSource, useUnsavedSourceFactory } from "./UnsavedGuardProvider";
export { NAVIGATION_PORT_ATTR } from "./guard";
export type { ConfirmLeave, GuardedRouter, LeaveKind, LeaveRequest, LinkNavigateJudge, UnsavedSource } from "./types";
