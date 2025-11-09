// src/components/Admin/layout/AdminSidebar.tsx

"use client";

import Link from "next/link";
import { cva } from "class-variance-authority";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Block } from "@/components/Layout/Block";
import { adminMenu } from "../../../config/admin-global-menu.config";
import { UI_BEHAVIOR_CONFIG } from "../../../config/ui-behavior-config";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { cn } from "@/lib/cn";
import { err } from "@/lib/errors";
import { AdminSidebarButton } from "./AdminSidebarButton";

const [{ adminGlobalMenu }] = UI_BEHAVIOR_CONFIG;

const sidebarContainer = cva(
  "min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-lg",
);

const submenuVariants = cva(
  "absolute left-full -ml-2 top-0 w-48 space-y-1 rounded bg-sidebar shadow-lg transition-all duration-200 z-10",
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

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      onNavigate?.();
      toast.success("ログアウトしました");
    } catch (error) {
      toast.error(err(error, "ログアウトに失敗しました"));
    }
  }, [logout, onNavigate]);

  const toggleIndex = (index: number) => {
    clearCloseTimeout();
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <aside style={{ width }} className={cn(sidebarContainer(), "flex flex-col")}>
      <Block space="xs" className="w-full">
        <nav aria-label="管理メニュー" className="w-full">
          <ul className="flex w-full flex-col p-0 list-none m-0">
            {adminMenu.map((section, i) => {
              const hasSubMenu = section.items.length > 0 && section.href === "#";
              const isOpen = openIndex === i;

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
                  {hasSubMenu ? (
                    <AdminSidebarButton
                      type="button"
                      onClick={() => toggleIndex(i)}
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                    >
                      {section.title}
                    </AdminSidebarButton>
                  ) : (
                    <AdminSidebarButton asChild>
                      <Link
                        href={section.href ?? "#"}
                        onClick={() => {
                          clearCloseTimeout();
                          setOpenIndex(null);
                          onNavigate?.();
                        }}
                      >
                        {section.title}
                      </Link>
                    </AdminSidebarButton>
                  )}
                  {hasSubMenu && (
                    <ul className={cn(submenuVariants({ open: isOpen }), "list-none m-0")}>
                      {section.items.map((item) => (
                        <li key={`${section.title}-${item.title}`}>
                          <Link
                            href={item.href}
                            className={cn(itemLink(), "block w-full py-6")}
                            onClick={() => {
                              clearCloseTimeout();
                              setOpenIndex(null);
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
      <Block space="xs" className="mt-auto w-full">
        <div className="group relative w-full">
          <AdminSidebarButton type="button" onClick={handleLogout} disabled={isLoading}>
            ログアウト
          </AdminSidebarButton>
        </div>
      </Block>
    </aside>
  );
}
