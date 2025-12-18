// src/features/core/adminCommand/definitions/logout/LogoutRenderer.tsx

"use client";

import { useEffect } from "react";
import { LogOutIcon, Loader2Icon } from "lucide-react";

import { Command, CommandList } from "@/components/_shadcn/command";
import type { CategoryRendererProps } from "@/features/core/adminCommand/base/types";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

/**
 * ログアウトカテゴリのレンダラー
 * カテゴリ選択時に即座にログアウト処理を実行
 */
export function LogoutRenderer({ onClose }: CategoryRendererProps) {
  const { logout, isLoading } = useLogout({ redirectTo: "/" });

  useEffect(() => {
    const executeLogout = async () => {
      try {
        await logout();
        onClose();
      } catch {
        // エラー時もパレットを閉じる
        onClose();
      }
    };

    executeLogout();
  }, [logout, onClose]);

  return (
    <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
      <CommandList>
        <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
          {isLoading ? (
            <>
              <Loader2Icon className="size-5 animate-spin" />
              <span>ログアウト中...</span>
            </>
          ) : (
            <>
              <LogOutIcon className="size-5" />
              <span>ログアウトしています...</span>
            </>
          )}
        </div>
      </CommandList>
    </Command>
  );
}
