// src/app/admin/insane/_layout/InsaneProtectedLayout.tsx

"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { useAdminLayoutStore } from "@/app/admin/_layout/stores/adminLayout";

import { InsaneResizableArea } from "./InsaneResizableArea";

/**
 * slot の約束(AdminLayout と同じ): 省略(undefined) = 既定の部品 / null = 描かない / 要素 = それを描く。
 * admin/insane/layout.tsx はガードと同居する提供者所有なので、fork から slot を渡す口は proxy の /admin 関所の区切りまで無い(../../_layout/README.md)
 */
export type InsaneProtectedLayoutProps = {
  readonly children: ReactNode;
  /**
   * サイドバーの中身。既定 = InsaneSidebar。要素は PC の列と SP のドロワーの殻の中に描く(幅・開閉・リサイズは枠が持ち、
   * 中身は useAdminSidebarFrame() で placement / width / close を読む)。null = サイドバー・リサイズのつまみ・SP の開閉ボタンを描かない
   */
  readonly sidebar?: ReactNode;
  /** スクロール領域の末尾のフッター。既定 = 無し(今の insane はフッターを持たない)。要素 = それを描く */
  readonly footer?: ReactNode;
};

export function InsaneProtectedLayout({ children, sidebar, footer }: InsaneProtectedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { setExtraClassName } = useAdminLayoutStore();

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // マウント時にinvertを適用、アンマウント時にクリア
  useEffect(() => {
    setExtraClassName("invert hue-rotate-180");
    return () => setExtraClassName(undefined);
  }, [setExtraClassName]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <InsaneResizableArea
        isSidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
        sidebar={sidebar}
        footer={footer}
      >
        {children}
      </InsaneResizableArea>
      {sidebar === null ? null : (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="fixed bottom-4 right-4 size-12 rounded-full surface-ui-layer md:hidden"
          onClick={toggleSidebar}
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? "メニューを閉じる" : "メニューを開く"}
        >
          {sidebarOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </Button>
      )}
    </div>
  );
}
