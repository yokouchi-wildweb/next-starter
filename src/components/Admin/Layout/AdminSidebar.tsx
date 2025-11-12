// src/components/Admin/layout/AdminSidebar.tsx

"use client";

import Link from "next/link";
import { cva } from "class-variance-authority";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Block } from "@/components/Layout/Block";
import { Span } from "@/components/TextBlocks";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { cn } from "@/lib/cn";
import { err } from "@/lib/errors";

import { adminMenu } from "../../../config/admin-global-menu.config";
import { UI_BEHAVIOR_CONFIG } from "../../../config/ui-behavior-config";
import { AdminSidebarButton, adminSidebarButtonClassName } from "./AdminSidebarButton";

const [{ adminGlobalMenu }] = UI_BEHAVIOR_CONFIG;

const sidebarContainer = cva(
  "min-h-[var(--viewport-height,100dvh)] bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-lg",
);

const hasHref = (href: string | null | undefined): href is string =>
  typeof href === "string" && href.length > 0;

type SidebarMenuItem = {
  title: string;
  href: string;
};

type SidebarMenuSection = {
  title: string;
  href: string | null;
  items: SidebarMenuItem[];
};

const sidebarSections: SidebarMenuSection[] = adminMenu.map((section) => {
  const primaryHref = hasHref(section.href) ? section.href : null;

  const items = section.items.reduce<SidebarMenuItem[]>((acc, item) => {
    if (!hasHref(item.href)) {
      return acc;
    }

    acc.push({
      title: item.title,
      href: item.href,
    });
    return acc;
  }, []);

  return {
    title: section.title,
    href: primaryHref,
    items,
  };
});

const submenuVariants = cva(
  "modal-layer absolute left-full -ml-2 top-0 w-48 space-y-1 rounded bg-sidebar shadow-xl ring-1 ring-sidebar-border/60 transition-all duration-200",
  {
    variants: {
      open: {
        true: "opacity-100 translate-x-0 pointer-events-auto",
        false: "opacity-0 translate-x-2 pointer-events-none",
      },
    },
    defaultVariants: { open: false },
  },
);

const itemLink = cva(
  "block px-4 py-4 text-sm rounded transition-colors duration-200 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
);

export function AdminSidebar({ width = 192, onNavigate }: { width?: number; onNavigate?: () => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { logout, isLoading } = useLogout({ redirectTo: "/admin/login" });

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setOpenIndex(null);
      closeTimeoutRef.current = null;
    }, adminGlobalMenu.submenuHideDelayMs);
  }, [clearCloseTimeout]);

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  const closeSubmenuImmediately = useCallback(() => {
    clearCloseTimeout();
    setOpenIndex(null);
  }, [clearCloseTimeout]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      onNavigate?.();
      toast.success("ログアウトしました");
    } catch (error) {
      toast.error(err(error, "ログアウトに失敗しました"));
    }
  }, [logout, onNavigate]);

  const focusIndex = (index: number) => {
    clearCloseTimeout();
    setOpenIndex(index);
  };

  return (
    <aside style={{ width }} className={cn(sidebarContainer(), "flex flex-col")}>
      <Block space="xs" className="w-full mb-0">
        <nav aria-label="管理メニュー" className="w-full">
          <ul className="flex w-full flex-col p-0 list-none m-0">
            {sidebarSections.map((section, i) => {
              const hasSubMenu = section.items.length > 0;
              const isOpen = openIndex === i;

              const handlePrimaryFocus = () => {
                if (!hasSubMenu) return;
                focusIndex(i);
              };

              return (
                <li
                  key={section.title}
                  className="relative w-full group"
                  onMouseEnter={() => {
                    if (!hasSubMenu) return;
                    clearCloseTimeout();
                    setOpenIndex(i);
                  }}
                  onMouseLeave={() => {
                    if (!hasSubMenu) return;
                    scheduleClose();
                  }}
                >
                  {section.href ? (
                    <AdminSidebarButton asChild>
                      <Link
                        href={section.href}
                        onClick={() => {
                          closeSubmenuImmediately();
                          onNavigate?.();
                        }}
                        onFocus={handlePrimaryFocus}
                        aria-haspopup={hasSubMenu || undefined}
                        aria-expanded={hasSubMenu ? isOpen : undefined}
                      >
                        {section.title}
                      </Link>
                    </AdminSidebarButton>
                  ) : (
                    <Span
                      tabIndex={hasSubMenu ? 0 : -1}
                      role={hasSubMenu ? "menuitem" : undefined}
                      aria-haspopup={hasSubMenu || undefined}
                      aria-expanded={hasSubMenu ? isOpen : undefined}
                      onFocus={handlePrimaryFocus}
                      onClick={() => {
                        if (!hasSubMenu) return;
                        focusIndex(i);
                      }}
                      onKeyDown={(event) => {
                        if (!hasSubMenu) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          focusIndex(i);
                        }
                      }}
                      className={cn(
                        adminSidebarButtonClassName,
                        "cursor-default outline-none focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground",
                      )}
                    >
                      {section.title}
                    </Span>
                  )}
                  {hasSubMenu && (
                    <ul className={cn(submenuVariants({ open: isOpen }), "list-none m-0")}>
                      {section.items.map((item) => (
                        <li key={`${section.title}-${item.title}`}>
                          <Link
                            href={item.href}
                            className={cn(itemLink(), "block w-full py-5")}
                            onClick={() => {
                              closeSubmenuImmediately();
                              onNavigate?.();
                            }}
                          >
                            {item.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </Block>
      <Block space="xs" className="w-full mt-0">
        <div className="group relative w-full">
          <AdminSidebarButton type="button" onClick={handleLogout} disabled={isLoading}>
            ログアウト
          </AdminSidebarButton>
        </div>
      </Block>
    </aside>
  );
}
