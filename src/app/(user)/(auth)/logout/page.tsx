// src/app/(user)/(auth)/logout/page.tsx

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { LogoutButton } from "@/features/core/auth/components/common/LogoutButton";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

const DEFAULT_REDIRECT_PATH = "/";

export default function LogoutPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? DEFAULT_REDIRECT_PATH;

  const { logout, isLoading, error } = useLogout({ redirectTo });
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;
    logout();
  }, [logout]);

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" space="md">
        {error ? (
          <>
            <p>ログアウトに失敗しました</p>
            <LogoutButton redirectTo={redirectTo} />
          </>
        ) : (
          <p>{isLoading ? "ログアウト中..." : "リダイレクト中..."}</p>
        )}
      </Flex>
    </UserPage>
  );
}
