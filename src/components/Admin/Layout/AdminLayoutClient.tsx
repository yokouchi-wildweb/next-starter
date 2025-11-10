"use client";

import { ReactNode, useState } from "react";
import { AdminHeader } from "./AdminHeader";
import { ResizableAdminLayout } from "./ResizableAdminLayout";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/Form/Button/Button";

type AdminLayoutClientProps = {
  children: ReactNode;
  headerLogoUrl?: string;
  headerLogoDarkUrl?: string;
};

export function AdminLayoutClient({
  children,
  headerLogoUrl,
  headerLogoDarkUrl,
}: AdminLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <>
      <AdminHeader logoUrl={headerLogoUrl} darkLogoUrl={headerLogoDarkUrl} />
      <ResizableAdminLayout isSidebarOpen={sidebarOpen} onSidebarClose={() => setSidebarOpen(false)}>
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
