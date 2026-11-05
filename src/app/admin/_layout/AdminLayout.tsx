"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

import { useFrameAttributes } from "@/app/_layout/frame/useFrameAttributes";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import { cn } from "@/lib/cn";

import { frameTable } from "./extensions/frameTable";
import { useAdminLayoutStore } from "./stores/adminLayout";

type AdminLayoutCSSVariables = CSSProperties & {
  "--app-header-height"?: string;
};

/**
 * ヘッダーは描かない(各ページの AdminPage が行を描く。行の差し替えは ./AdminHeader の 1 行スイッチ)。
 * fork は admin/layout.tsx を丸ごと置き換え `AdminLayout.replace.tsx` へ向けてもよい。経緯と手順: ./README.md
 */
export type AdminLayoutProps = {
  readonly children: ReactNode;
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
export function AdminLayout({ children, className }: AdminLayoutProps) {
  const headerHeight = useHeaderHeight();
  const { extraClassName } = useAdminLayoutStore();
  const frameAttributes = useFrameAttributes(frameTable);

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
      {/* ヘッダー固定 + メイン領域は配下が独自にスクロールを担う土台。
          ここは scroll container 化させてはならないため overflow-clip を使う。
          overflow-hidden は視覚クリップは効くが scroll container として残るため、sr-only な
          checkbox（SwitchInput など）に focus が移った際のブラウザ自動 scrollIntoView で
          ここの scrollTop が動いてしまい、フォーム全体が画面外へ押し出される崩れが起きる。
          overflow-clip は CSS 仕様上 scroll container を作らないため focus 駆動の
          スクロールも発火しない。配下（ResizableArea / InsaneResizableArea / login・setup の
          Screen が Main を包む overflow-y-auto の Block）が自前でスクロール可能領域を確保する前提。 */}
      {/* AdminPage の行は上端に固定なので、その高さ(--app-header-height)を上の余白で空ける(利用者の枠の UserLayout と同じ形) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-clip pt-[var(--app-header-height,0px)]">{children}</div>
    </div>
  );
}
