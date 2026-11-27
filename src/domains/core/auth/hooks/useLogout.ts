// src/domains/auth/hooks/useLogout.ts

"use client";

import { useCallback, useRef, useState } from "react";
import { signOut } from "firebase/auth";

import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";
import { logout as logoutService } from "@/domains/core/auth/services/client/logout";
import type { HttpError } from "@/lib/errors";
import { isHttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client";
import { reloadTo } from "@/lib/url";


type UseLogoutOptions = {
  redirectTo?: string;
  skipRedirect?: boolean;
};

const DEFAULT_REDIRECT_PATH = "/login";

export function useLogout({
  redirectTo = DEFAULT_REDIRECT_PATH,
  skipRedirect = false,
}: UseLogoutOptions = {}) {
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);
  const lockRef = useRef(false);

  const handleLogout = useCallback(async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      await logoutService();

      // Firebase Auth からもサインアウトする。
      try {
        await signOut(auth);
      } catch {
        // Firebase Auth のサインアウトに失敗しても、ローカルセッションは削除済みのため握り潰す。
      }

      try {
        await refreshSession();
      } catch {
        // refreshSession はログアウト後に 401 を受け取る可能性がある。
        // その際にも Context 内のユーザー情報は null へ更新されるため握り潰す。
      }

      if (!skipRedirect) {
        // 利用者が替わる: ページの読み直しで前の人の値を残さない(D139)
        reloadTo(redirectTo);
      }
    } catch (unknownError) {
      if (isHttpError(unknownError)) {
        setError(unknownError);
      } else {
        setError(null);
      }
      throw unknownError;
    } finally {
      lockRef.current = false;
      setIsLoading(false);
    }
  }, [redirectTo, refreshSession, skipRedirect]);

  return {
    logout: handleLogout,
    isLoading,
    error,
  } as const;
}

