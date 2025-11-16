// src/components/Admin/Sections/Header.tsx

"use client";

import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";
import Link from "next/link";

import { DarkModeSwitch } from "@/components/Fanctional/DarkModeSwitch";
import { APP_FEATURES } from "@/config/app-features.config";
import { APP_HEADER_ELEMENT_ID } from "@/constants/layout";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";

const headerContainer = cva(
  "flex items-center justify-between gap-3 px-4 py-2 text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:py-3 sm:text-lg",
);

type AdminHeaderProps = {
  logoUrl?: string;
  darkLogoUrl?: string;
};

export function Header({ logoUrl, darkLogoUrl }: AdminHeaderProps) {
  const lightLogoSrc = logoUrl ?? "/imgs/logos/nextjs.png";
  const darkLogoSrc = darkLogoUrl ?? logoUrl ?? "/imgs/logos/nextjs-dm.png";
  const showDarkModeSwitch = APP_FEATURES.admin.appearance.enableDarkModeSwitch;
  const { isAuthenticated } = useAuthSession();

  return (
    <header id={APP_HEADER_ELEMENT_ID} className={cn(headerContainer())}>
      <Link href="/admin" className="block p-1 sm:p-2" prefetch={isAuthenticated}>
        <img
          src={lightLogoSrc}
          alt="管理画面ロゴ（ライトモード）"
          className="block h-auto max-h-6 max-w-[120px] dark:hidden sm:max-h-none sm:max-w-[300px]"
        />
        <img
          src={darkLogoSrc}
          alt="管理画面ロゴ（ダークモード）"
          className="hidden h-auto max-h-6 max-w-[120px] dark:block sm:max-h-none sm:max-w-[300px]"
        />
      </Link>
      {showDarkModeSwitch ? <DarkModeSwitch /> : null}
    </header>
  );
}
