"use client";

import { type ReactNode, useCallback, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

import { ResizableArea } from "./ResizableArea";

type AdminProtectedLayoutClientProps = {
  children: ReactNode;
};

export function AdminProtectedLayout({ children }: AdminProtectedLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <>
      <ResizableArea
        isSidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
      >
        {children}
      </ResizableArea>
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
    </>
  );
}
