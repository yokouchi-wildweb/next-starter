// src/app/admin/(protected)/_layout/ResizableArea.tsx

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { adminLayoutConfig } from "@/app/admin/_layout/config";
import { Footer } from "./Footer";
import { PcSidebar } from "./Sidebar/PcSidebar";
import { SpSidebar } from "./Sidebar/SpSidebar";

export function ResizableArea({
  children,
  isSidebarOpen = false,
  onSidebarClose,
  sidebar,
  footer,
}: {
  children: ReactNode;
  isSidebarOpen?: boolean;
  onSidebarClose?: () => void;
  /** サイドバーの中身(AdminProtectedLayout の sidebar slot)。省略 = BaseSidebar / null = サイドバーとリサイズのつまみを描かない */
  sidebar?: ReactNode;
  /** スクロール領域の末尾(AdminProtectedLayout の footer slot)。省略 = Footer / null = 描かない */
  footer?: ReactNode;
}) {
  const hasSidebar = sidebar !== null;
  const [sidebarWidth, setSidebarWidth] = useState(192); // default 192px
  const dragging = useRef(false);
  const isSidebarResizable = adminLayoutConfig.enableSidebarResizing;

  useEffect(() => {
    if (!isSidebarResizable || !hasSidebar) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.min(Math.max(180, e.clientX), 600);
      setSidebarWidth(newWidth);
    };
    const stopDragging = () => {
      dragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [isSidebarResizable, hasSidebar]);

  return (
    <div className="flex h-full min-h-0 relative">
      {hasSidebar ? (
        <>
          <SpSidebar width={sidebarWidth} isOpen={isSidebarOpen} onClose={onSidebarClose} content={sidebar} />
          <PcSidebar width={sidebarWidth} content={sidebar} />
        </>
      ) : null}

      {hasSidebar && isSidebarResizable ? (
        <div
          data-slot="admin-sidebar"
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = "ew-resize";
          }}
          className="hidden md:block h-full w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"
        />
      ) : null}

      {/* メイン領域: ここがスクロールコンテナ。Footer は内部末尾に流し込み、
          コンテンツが短い場合は flex-1 のスペーサで最下部に押し下げる sticky-bottom 構成。

          ラッパーは既定では display:block のまま（flex-1 は flex アイテムとしての
          伸長指定）。non-fill ページ（中身が overflow-hidden な Main）は、この
          ブロックラッパーが中身の高さぶんに伸びることでコンテナがスクロールする。
          直接 flex アイテム化すると Main の overflow-hidden により最小高が 0 に
          潰れてクリップされる（＝スクロール不能になる）ため、ここは必ずブロック。

          ルートの枠の宣言が fill(frame.ts / frame.override.ts の fill: true)の時だけ、外枠の
          data-frame-fill を読んでこのラッパーを flex-col + min-h-0 の束縛モードに切り替え、直下の
          ページの本文(#main)を flex-1 min-h-0 にする（styles/core/frame.css）。
          これにより高さチェーンがページへ伝播し、内部ペインが独自スクロール、外側は非スクロールになる。 */}
      <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden">
        <div data-slot="admin-main" data-admin-main-wrapper className="flex-1">
          {children}
        </div>
        {footer === undefined ? <Footer /> : footer}
      </div>
    </div>
  );
}
