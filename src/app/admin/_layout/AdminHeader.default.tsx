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

// 行の高さは端末(SP / PC)ごとに決まった値 --admin-header-row-height(src/styles/core。枠の初期の --app-header-height も同じ値を読む)。
// 中身で行が伸び縮みしないので、本文の位置が後から測った高さに頼らない。中身はこの高さに収める(はみ出しは切る。
// 画面ごとに高い行を宣言する特例は作らない)。
// 横幅に入りきらないときの決まり(画面ごとの対応はしない): ロゴと明暗の切り替えは縮めない(shrink-0)。題の欄と中央は縮み、
// 題は末尾を … で省く。右の操作は切らない: PC(sm 以上)は縮めず、SP だけ縮む(中の部品が … で省いて収める。例 AdminEditItemNavigator)。縦 padding は --admin-header-padding-y トークン経由(行の高さの内側)。
// downstream はトークン上書きだけでヘッダー密度を変更でき、共有コンポーネントを編集する必要がない。
const headerContainer = cva(
  "flex h-[var(--admin-header-row-height)] items-center justify-between gap-3 overflow-clip px-4 py-[var(--admin-header-padding-y)] text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:text-lg",
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
        {/* 箱の大きさは画像の読み込みの前から決める(高さ h-6 / sm:h-12 + 上流のロゴ素材の縦横比 300:61 → SP 24×118 / PC 48×236)。
            読み込みで行が動かない。ヘッダーはファーストビューなので両方 priority(隠れている方の 1 枚も先読みする) */}
        <AppImage
          mode="intrinsic"
          src={logoPath("dark")}
          alt="管理画面ロゴ（ライトモード）"
          width={300}
          height={61}
          priority
          className="block aspect-[300/61] h-6 w-auto dark:hidden sm:h-12"
        />
        <AppImage
          mode="intrinsic"
          src={logoPath("light")}
          alt="管理画面ロゴ（ダークモード）"
          width={300}
          height={61}
          priority
          className="hidden aspect-[300/61] h-6 w-auto dark:block sm:h-12"
        />
      </Link>

      {/* 題: ロゴの右隣(sm 以上で表示。SP の題は AdminPage の本文の大見出し) */}
      <div data-slot="admin-header-title" className="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex">
        {title}
      </div>

      {/* 中央: タブ・検索など */}
      <div data-slot="admin-header-center" className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
        {center}
      </div>

      {/* 右: ページの操作 + ダークモードスイッチ(エリアが switchable のときだけ描画される。
          切替可否は src/config/ui/site-theme.config.ts の areas.admin.switchable) */}
      <div className="flex min-w-0 shrink-0 items-center gap-3 max-sm:shrink">
        <div data-slot="admin-header-right" className="flex min-w-0 items-center gap-3">
          {actions}
        </div>
        <DarkModeSwitch className="shrink-0" />
      </div>
    </header>
  );
}
