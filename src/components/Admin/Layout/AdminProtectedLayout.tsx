"use client";

import { type ReactNode, useState } from "react";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

import { ResizableAdminLayout } from "./ResizableAdminLayout";

type AdminProtectedLayoutClientProps = {
  children: ReactNode;
};

export function AdminProtectedLayout({ children }: AdminProtectedLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <ResizableAdminLayout
        isSidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
      >
        {children}
      </ResizableAdminLayout>
      <Button
        type="button"
        variant="accent"
        size="icon"
        className="fixed bottom-4 right-4 size-12 rounded-full md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Toggle menu"
      >
        <MenuIcon className="size-5" />
      </Button>
    </>
  );
}
