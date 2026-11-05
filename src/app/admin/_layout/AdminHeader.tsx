// src/app/admin/_layout/AdminHeader.tsx

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

import { AdminHeaderSlots } from "./HeaderSlots";

// 縦 padding は --admin-header-padding-y トークン経由（sm 切替はトークン側の
// メディアクエリで吸収）。downstream はトークン上書きだけでヘッダー密度を
// 変更でき、共有コンポーネントを編集する必要がない。
const headerContainer = cva(
  "flex items-center justify-between gap-3 px-4 py-[var(--admin-header-padding-y)] text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:text-lg",
);

export type AdminHeaderProps = {
  /** 行の題の位置(ロゴの右隣、sm 以上で表示)に描く物。受け口 #admin-header-title-slot の中 */
  readonly title?: ReactNode;
  /** 行の中央に描く物(タブ・検索など)。受け口 #admin-header-center-slot の中 */
  readonly center?: ReactNode;
  /** 行の右(明暗の切り替えの前)に描く操作。受け口 #admin-header-right-slot の中 */
  readonly actions?: ReactNode;
  /** 置き方のクラス(AdminPage が固定の置き方を渡す)。見た目のクラスは部品が持つ */
  readonly className?: string;
};

/**
 * 管理画面のヘッダーの行の部品: ロゴの Link + 題 / 中央 / 右の位置 + DarkModeSwitch。
 * 行は各ページの AdminPage が描く(title / center / actions の props)。受け口の id と data-slot は今の名前のまま行の中に残し、
 * AdminHeaderPortal・PageTitle placement="header"・ItemNavigator の差し込みもここに着地する(指令 16 で portal と id を消すまでの橋)
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

      {/* タイトル / 中央 / 右の受け口 + ダークモードスイッチ(エリアが switchable のときだけ描画される。
          切替可否は src/config/ui/site-theme.config.ts の areas.admin.switchable) */}
      <AdminHeaderSlots title={title} center={center} right={actions} trailing={<DarkModeSwitch />} />
    </header>
  );
}
