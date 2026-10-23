// src/components/AppFrames/Admin/Insane/InsaneProtectedLayout.tsx

"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { useAdminLayoutStore } from "@/stores/adminLayout";

import { InsaneResizableArea } from "./InsaneResizableArea";

type InsaneProtectedLayoutProps = {
  children: ReactNode;
};

export function InsaneProtectedLayout({ children }: InsaneProtectedLayoutProps) {
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
      >
        {children}
      </InsaneResizableArea>
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
    </div>
  );
}
