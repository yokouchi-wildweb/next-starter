// 型
export type {
  TransitionToken,
  IssueTokenOptions,
  GuardFailAction,
  TransitionGuardConfig,
  GuardFailReason,
  GuardResult,
  UseTransitionGuardResult,
} from "./types";

// 定数
export {
  TRANSITION_TOKEN_STORAGE_KEY,
  DEFAULT_TOKEN_TTL_MS,
  GUARD_FAIL_MESSAGES,
} from "./constants";

// フック
export { useGuardedNavigation } from "./guardedNavigation";
export { useTransitionGuard } from "./useTransitionGuard";

// ユーティリティ（必要に応じて直接使用）
export { issueToken } from "./issueToken";
export { validateGuard } from "./validateToken";
export { saveToken, getToken, consumeToken } from "./storage";
