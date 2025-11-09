// src/components/Admin/layout/AdminHeader.tsx

"use client";

import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { DarkModeSwitch } from "@/components/Fanctional/DarkModeSwitch";
import Link from "next/link";
import { APP_FEATURES } from "@/config/app-features.config";

const headerContainer = cva(
  "flex justify-between items-center px-6 py-3 bg-muted text-muted-foreground shadow-sm font-bold text-lg",
);

type AdminHeaderProps = {
  logoUrl?: string;
  darkLogoUrl?: string;
};

export function AdminHeader({ logoUrl, darkLogoUrl }: AdminHeaderProps) {
  const lightLogoSrc = logoUrl ?? "/imgs/logos/nextjs.png";
  const darkLogoSrc = darkLogoUrl ?? logoUrl ?? "/imgs/logos/nextjs-dm.png";
  const showDarkModeSwitch = APP_FEATURES.admin.appearance.enableDarkModeSwitch;

  return (
    <header className={cn(headerContainer())}>
      <Link href="/admin" className="block p-2">
        <img
          src={lightLogoSrc}
          alt="管理画面ロゴ（ライトモード）"
          className="block h-auto max-w-[300px] dark:hidden"
        />
        <img
          src={darkLogoSrc}
          alt="管理画面ロゴ（ダークモード）"
          className="hidden h-auto max-w-[300px] dark:block"
        />
      </Link>
      {showDarkModeSwitch ? <DarkModeSwitch /> : null}
    </header>
  );
}
