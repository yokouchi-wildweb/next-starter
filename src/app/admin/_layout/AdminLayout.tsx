"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

import { useFrameAttributes } from "@/app/_layout/frame/useFrameAttributes";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import { cn } from "@/lib/cn";

import { AdminHeaderReplacedProvider } from "./AdminHeaderContext";
import { frameTable } from "./extensions/frameTable";
import { useAdminLayoutStore } from "./stores/adminLayout";

type AdminLayoutCSSVariables = CSSProperties & {
  "--app-header-height"?: string;
};

/**
 * slot の約束(User の UserLayout と同じ): 省略(undefined) = 既定の部品 / null = 描かない / 要素 = それを描く。
 * fork は admin/layout.tsx を丸ごと置き換え `AdminLayout.replace.tsx` へ向け、そこで既定の AdminLayout に slot を渡す。
 * 経緯と手順: ./README.md
 */
export type AdminLayoutProps = {
  readonly children: ReactNode;
  /**
   * ヘッダーの差し替え(今までどおりの口。指令 17 で AdminHeader の差し替えに置き換える)。
   * 省略 = 器はヘッダーを描かず、各ページの AdminPage が行を描く(上端に固定、器が上の余白で高さを空ける)。
   * 要素 = それを器の先頭(今までの場所、流れの中)に描き、AdminPage は自分の行を描かない / null = どちらも描かない。
   * 差し替えるヘッダーは ./HeaderSlots の AdminHeaderSlots を描くと、PageTitle placement="header"・AdminHeaderPortal の受け口が残る
   */
  readonly header?: ReactNode;
  /** 外枠に足すクラス名（invert等のスタイル制御用） */
  readonly className?: string;
};

/**
 * 管理画面の外枠(ヘッダーを描かない器 + 子領域)の既定の組み立て。src/app/admin/layout.tsx が 1 行スイッチで default に束ねる。
 * ヘッダーの行は各ページの AdminPage が描く(./AdminPage)。
 * 外枠 = 枠の根(data-frame-root)。今のルートの枠の宣言(frame.default.ts / frame.ts → 管理の表 ./extensions/frameTable)を
 * 共通の読み手 useFrameAttributes が属性にし、src/styles/core/frame.css が部位(data-slot の admin-header・admin-sidebar・admin-footer)を
 * 隠す・fill で本文に残りの高さを埋めさせる
 */
export function AdminLayout({ children, header, className }: AdminLayoutProps) {
  const headerHeight = useHeaderHeight();
  const { extraClassName } = useAdminLayoutStore();
  const frameAttributes = useFrameAttributes(frameTable);
  // header の prop が渡された(要素でも null でも)= ヘッダーの差し替え。AdminPage の行を止め、渡された物を今までの場所に描く
  const replaced = header !== undefined;

  // ヘッダーの高さは測れた時だけ書く(null = 測る前。最初の HTML とページを移る間は styles/core/frame.css の初期値 = 今の行の高さが効き、
  // 本文が固定の行に重ならない)。測った値は初期値を上書きするだけ(隠している間の 0 も書く)。
  // 寸法変数のうち書くのは --app-header-height だけ。Admin には banner も bottomNav も無いので
  // --app-banner-height / --app-bottom-nav-height は styles/core/config.css の :root の 0px を継ぐ(safe-area も :root)
  const layoutStyle: AdminLayoutCSSVariables = useMemo(
    () => ({
      ...(headerHeight === null ? {} : { "--app-header-height": `${headerHeight}px` }),
    }),
    [headerHeight],
  );

  return (
    <div
      className={cn(
        "relative flex h-[var(--viewport-height,100dvh)] flex-col overflow-hidden bg-background text-foreground",
        className,
        extraClassName,
      )}
      style={layoutStyle}
      data-slot="admin-app-container"
      data-frame-root=""
      {...frameAttributes}
    >
      {replaced ? header : null}
      {/* ヘッダー固定 + メイン領域は配下が独自にスクロールを担う土台。
          ここは scroll container 化させてはならないため overflow-clip を使う。
          overflow-hidden は視覚クリップは効くが scroll container として残るため、sr-only な
          checkbox（SwitchInput など）に focus が移った際のブラウザ自動 scrollIntoView で
          ここの scrollTop が動いてしまい、フォーム全体が画面外へ押し出される崩れが起きる。
          overflow-clip は CSS 仕様上 scroll container を作らないため focus 駆動の
          スクロールも発火しない。配下（ResizableArea / InsaneResizableArea / login・setup の
          Screen が Main を包む overflow-y-auto の Block）が自前でスクロール可能領域を確保する前提。 */}
      {/* 差し替えのヘッダーが無いとき: AdminPage の行は上端に固定なので、その高さ(実測の --app-header-height)を上の余白で空ける
          (利用者の枠の UserLayout と同じ形)。差し替えのヘッダーは流れの中に置くので余白は要らない */}
      <div className={cn("flex-1 min-h-0 flex flex-col overflow-clip", !replaced && "pt-[var(--app-header-height,0px)]")}>
        <AdminHeaderReplacedProvider replaced={replaced}>{children}</AdminHeaderReplacedProvider>
      </div>
    </div>
  );
}
