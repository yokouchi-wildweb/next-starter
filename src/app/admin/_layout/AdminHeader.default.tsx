// src/app/admin/_layout/AdminHeader.default.tsx

"use client";

import type { ReactNode } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/cn";
import { Link } from "@/components/Navigation";
import { DarkModeSwitch } from "@/components/Fanctional/DarkModeSwitch";
import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { AppImage } from "@/components/Media/AppImage";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { logoPath } from "@/utils/assets";

// 縦 padding は --admin-header-padding-y トークン経由（sm 切替はトークン側の
// メディアクエリで吸収）。downstream はトークン上書きだけでヘッダー密度を
// 変更でき、共有コンポーネントを編集する必要がない。
const headerContainer = cva(
  "flex items-center justify-between gap-3 px-4 py-[var(--admin-header-padding-y)] text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:text-lg",
);

export type AdminHeaderProps = {
  /** 行の題の位置(ロゴの右隣、sm 以上で表示)に描く物(AdminPage は title から圧縮の題を渡す) */
  readonly title?: ReactNode;
  /** 行の中央に描く物(タブ・検索など) */
  readonly center?: ReactNode;
  /** 行の右(明暗の切り替えの前)に描く操作 */
  readonly actions?: ReactNode;
  /** 置き方のクラス(AdminPage が固定の置き方を渡す)。見た目のクラスは部品が持つ */
  readonly className?: string;
};

/**
 * 管理画面のヘッダーの行の上流の既定: ロゴの Link + 題 / 中央 / 右の位置(data-slot admin-header-title / -center / -right)+ DarkModeSwitch。
 * 行は各ページの AdminPage が描き、title / center / actions を props で渡す(ページごとに変わる中身はページの中で描く、D134)。
 * 差し替えの口 = 1 行スイッチ: ./AdminHeader.tsx がこのファイルを指す。fork は AdminHeader.replace.tsx に同じ名前・同じ props の
 * AdminHeader を書き、./AdminHeader.tsx の 1 行をそちらへ向ける(手順: ./README.md)
 */
export function AdminHeader({ title, center, actions, className }: AdminHeaderProps) {
  const { isAuthenticated } = useAuthSession();

  return (
    <header id={APP_HEADER_ELEMENT_ID} data-slot="admin-header" className={cn(headerContainer(), className)}>
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

      {/* 題: ロゴの右隣(sm 以上で表示。SP の題は AdminPage の本文の大見出し) */}
      <div data-slot="admin-header-title" className="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex">
        {title}
      </div>

      {/* 中央: タブ・検索など */}
      <div data-slot="admin-header-center" className="flex min-w-0 flex-1 items-center justify-center">
        {center}
      </div>

      {/* 右: ページの操作 + ダークモードスイッチ(エリアが switchable のときだけ描画される。
          切替可否は src/config/ui/site-theme.config.ts の areas.admin.switchable) */}
      <div className="flex shrink-0 items-center gap-3">
        <div data-slot="admin-header-right" className="flex items-center gap-3">
          {actions}
        </div>
        <DarkModeSwitch />
      </div>
    </header>
  );
}
