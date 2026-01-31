// src/features/auth/hooks/useLogout.ts

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { logout as logoutService } from "@/features/core/auth/services/client/logout";
import type { HttpError } from "@/lib/errors";
import { isHttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";

type UseLogoutOptions = {
  redirectTo?: string;
  skipRedirect?: boolean;
};

const DEFAULT_REDIRECT_PATH = "/login";

export function useLogout({
  redirectTo = DEFAULT_REDIRECT_PATH,
  skipRedirect = false,
}: UseLogoutOptions = {}) {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleLogout = useCallback(async () => {
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
        router.replace(redirectTo);
        router.refresh();
      }
    } catch (unknownError) {
      if (isHttpError(unknownError)) {
        setError(unknownError);
      } else {
        setError(null);
      }
      throw unknownError;
    } finally {
      setIsLoading(false);
    }
  }, [redirectTo, refreshSession, router, skipRedirect]);

  return {
    logout: handleLogout,
    isLoading,
    error,
  } as const;
}

