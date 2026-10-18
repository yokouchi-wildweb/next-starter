// src/app/(user)/(auth)/logout/_screen/LogoutSection.tsx
// ログアウトの自動実行部品(既定 Screen 専用、契約外)。mount 時に 1 回だけ hook(useLogout)を発火し、
// 失敗時は再試行ボタンを出す。差し替え Screen は ../_screen/LogoutSection を import するか、hook 直結で作り直す

"use client";

import { useEffect, useRef } from "react";

import { Para } from "@/components/TextBlocks";
import { LogoutButton } from "@/features/core/auth/components/common/LogoutButton";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

type Props = {
  /** ログアウト後の遷移先(loader が内部パスに限定済み) */
  redirectTo: string;
};

export function LogoutSection({ redirectTo }: Props) {
  const { logout, isLoading, error } = useLogout({ redirectTo });
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;
    logout().catch(() => {
      // エラーは hook の error に入るので、ここでは握り潰す
    });
  }, [logout]);

  if (error) {
    return (
      <>
        <Para>ログアウトに失敗しました</Para>
        <LogoutButton redirectTo={redirectTo} />
      </>
    );
  }

  return <Para>{isLoading ? "ログアウト中..." : "リダイレクト中..."}</Para>;
}
