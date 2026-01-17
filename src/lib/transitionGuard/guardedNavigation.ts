"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { issueToken } from "./issueToken";
import { saveToken } from "./storage";
import type { IssueTokenOptions } from "./types";

/**
 * トークン発行付きのナビゲーション関数を提供するフック
 *
 * @example
 * ```tsx
 * const { guardedPush, guardedReplace } = useGuardedNavigation();
 *
 * // 通常の使用
 * guardedPush("/signup/complete");
 *
 * // 特定トークン付き
 * guardedPush("/gacha/result", { key: `gacha:roll:${sessionId}` });
 * ```
 */
export function useGuardedNavigation() {
  const router = useRouter();

  const guardedPush = useCallback(
    (path: string, options?: IssueTokenOptions) => {
      const token = issueToken(path, options);
      saveToken(token);
      router.push(path);
    },
    [router]
  );

  const guardedReplace = useCallback(
    (path: string, options?: IssueTokenOptions) => {
      const token = issueToken(path, options);
      saveToken(token);
      router.replace(path);
    },
    [router]
  );

  return { guardedPush, guardedReplace };
}
