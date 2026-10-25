// src/app/admin/(protected)/_layout/AdminProtectedLayout.tsx

"use client";

import { type ReactNode, useCallback, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

import { ResizableArea } from "./ResizableArea";

/**
 * slot の約束(AdminLayout と同じ): 省略(undefined) = 既定の部品 / null = 描かない / 要素 = それを描く。
 * admin/(protected)/layout.tsx はガードと同居する提供者所有なので、fork から slot を渡す口は proxy の /admin 関所の区切りまで無い(../../_layout/README.md)
 */
export type AdminProtectedLayoutProps = {
  readonly children: ReactNode;
  /**
   * サイドバーの中身。既定 = BaseSidebar。要素は PC の列と SP のドロワーの殻の中に描く(幅・開閉・リサイズは枠が持ち、
   * 中身は useAdminSidebarFrame() で placement / width / close を読む)。null = サイドバー・リサイズのつまみ・SP の開閉ボタンを描かない
   */
  readonly sidebar?: ReactNode;
  /** スクロール領域の末尾のフッター。既定 = ./Footer。null = 描かない */
  readonly footer?: ReactNode;
};

export function AdminProtectedLayout({ children, sidebar, footer }: AdminProtectedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <>
      <ResizableArea
        isSidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
        sidebar={sidebar}
        footer={footer}
      >
        {children}
      </ResizableArea>
      {sidebar === null ? null : (
        <Button
          type="button"
          variant="accent"
          size="icon"
          className="fixed bottom-4 right-4 size-12 rounded-full surface-ui-layer md:hidden"
          onClick={toggleSidebar}
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? "メニューを閉じる" : "メニューを開く"}
        >
          {sidebarOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </Button>
      )}
    </>
  );
}
