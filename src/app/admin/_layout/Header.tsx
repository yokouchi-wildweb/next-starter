// src/app/admin/_layout/Header.tsx

"use client";

import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Link } from "@/components/Navigation";

import { DarkModeSwitch } from "@/components/Fanctional/DarkModeSwitch";
import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { AppImage } from "@/components/Media/AppImage";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { logoPath } from "@/utils/assets";

import { AdminHeaderSlots } from "./HeaderSlots";

// 縦 padding は --admin-header-padding-y トークン経由（sm 切替はトークン側の
// メディアクエリで吸収）。downstream はトークン上書きだけでヘッダー密度を
// 変更でき、共有コンポーネントを編集する必要がない。
const headerContainer = cva(
  "flex items-center justify-between gap-3 px-4 py-[var(--admin-header-padding-y)] text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:text-lg",
);

export function Header() {
  const { isAuthenticated } = useAuthSession();

  return (
    <header id={APP_HEADER_ELEMENT_ID} data-slot="admin-header" className={cn(headerContainer())}>
      {/* 左側: ロゴ */}
      <Link href="/admin" className="block shrink-0 p-1 sm:p-2" prefetch={isAuthenticated}>
        {/* width/height は上流のロゴ素材(1280x260)の縦横比のヒント。実表示の大きさは className の max-* + w-auto/h-auto が決める。
            ヘッダーはファーストビューなので両方 priority(隠れている方の 1 枚も先読みする) */}
        <AppImage
          mode="intrinsic"
          src={logoPath("dark")}
          alt="管理画面ロゴ（ライトモード）"
          width={300}
          height={61}
          priority
          className="block h-auto w-auto max-h-6 max-w-[120px] dark:hidden sm:max-h-12 sm:max-w-[300px]"
        />
        <AppImage
          mode="intrinsic"
          src={logoPath("light")}
          alt="管理画面ロゴ（ダークモード）"
          width={300}
          height={61}
          priority
          className="hidden h-auto w-auto max-h-6 max-w-[120px] dark:block sm:max-h-12 sm:max-w-[300px]"
        />
      </Link>

      {/* タイトル / 中央 / 右の受け口 + ダークモードスイッチ(エリアが switchable のときだけ描画される。
          切替可否は src/config/ui/site-theme.config.ts の areas.admin.switchable) */}
      <AdminHeaderSlots trailing={<DarkModeSwitch />} />
    </header>
  );
}
