// src/components/Admin/Sections/Header.tsx

"use client";

import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";
import Link from "next/link";

import { DarkModeSwitch } from "@/components/Fanctional/DarkModeSwitch";
import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  APP_HEADER_ELEMENT_ID,
  ADMIN_HEADER_CENTER_SLOT_ID,
  ADMIN_HEADER_RIGHT_SLOT_ID,
} from "@/components/AppFrames/constants";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { logoPath } from "@/utils/assets";

const headerContainer = cva(
  "flex items-center justify-between gap-3 px-4 py-2 text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:py-3 sm:text-lg",
);

export function Header() {
  const showDarkModeSwitch = APP_FEATURES.adminConsole.enableDarkModeSwitch;
  const { isAuthenticated } = useAuthSession();

  return (
    <header id={APP_HEADER_ELEMENT_ID} className={cn(headerContainer())}>
      {/* 左側: ロゴ */}
      <Link href="/admin" className="block shrink-0 p-1 sm:p-2" prefetch={isAuthenticated}>
        <img
          src={logoPath("dark")}
          alt="管理画面ロゴ（ライトモード）"
          className="block h-auto max-h-6 max-w-[120px] dark:hidden sm:max-h-12 sm:max-w-[300px]"
        />
        <img
          src={logoPath("light")}
          alt="管理画面ロゴ（ダークモード）"
          className="hidden h-auto max-h-6 max-w-[120px] dark:block sm:max-h-12 sm:max-w-[300px]"
        />
      </Link>

      {/* 中央: ポータルスロット */}
      <div
        id={ADMIN_HEADER_CENTER_SLOT_ID}
        className="flex min-w-0 flex-1 items-center justify-center"
      />

      {/* 右側: ポータルスロット + ダークモードスイッチ */}
      <div className="flex shrink-0 items-center gap-3">
        <div id={ADMIN_HEADER_RIGHT_SLOT_ID} className="flex items-center gap-3" />
        {showDarkModeSwitch ? <DarkModeSwitch /> : null}
      </div>
    </header>
  );
}
