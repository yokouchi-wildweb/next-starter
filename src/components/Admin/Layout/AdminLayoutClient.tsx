"use client";

import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";

import { AdminFooter } from "./AdminFooter";
import { AdminHeader } from "./AdminHeader";
import { ResizableAdminLayout } from "./ResizableAdminLayout";

type AdminLayoutClientProps = {
  children: ReactNode;
  headerLogoUrl?: string;
  headerLogoDarkUrl?: string;
  footerText?: string | null;
};

type AdminLayoutCSSVariables = CSSProperties & {
  "--app-header-height"?: string;
};

export function AdminLayoutClient({
  children,
  headerLogoUrl,
  headerLogoDarkUrl,
  footerText,
}: AdminLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headerHeight = useHeaderHeight();

  const layoutStyle: AdminLayoutCSSVariables = useMemo(
    () => ({
      "--app-header-height": `${headerHeight}px`,
    }),
    [headerHeight],
  );

  return (
    <div
      className="relative flex min-h-screen flex-col bg-background text-foreground"
      style={layoutStyle}
    >
      <AdminHeader logoUrl={headerLogoUrl} darkLogoUrl={headerLogoDarkUrl} />
      <div className="flex flex-1 flex-col min-h-[calc(100vh-var(--app-header-height,0px))]">
        <ResizableAdminLayout isSidebarOpen={sidebarOpen} onSidebarClose={() => setSidebarOpen(false)}>
          {children}
        </ResizableAdminLayout>
        <AdminFooter text={footerText} />
      </div>
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
    </div>
  );
}
