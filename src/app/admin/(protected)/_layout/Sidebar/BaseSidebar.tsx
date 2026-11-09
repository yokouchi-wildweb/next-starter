// src/app/admin/(protected)/_layout/Sidebar/BaseSidebar.tsx

"use client";

import { Link } from "@/components/Navigation";
import { cva } from "class-variance-authority";
import { useCallback, useEffect, useRef, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks";
import { useLogout } from "@/features/core/auth/hooks/useLogout";
import { cn } from "@/lib/cn";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { useAdminMenu } from "@/features/core/admin/hooks/useAdminMenu";
import { adminLayoutConfig } from "@/app/admin/_layout/config";
import { MenuButton, adminSidebarButtonClassName } from "@/app/admin/_layout/Sidebar/MenuButton";

import { ADMIN_HOME_LINK, ADMIN_LOGOUT_ICON, ADMIN_MENU_ICONS_ENABLED, ADMIN_SITE_LINK } from "./frameValues";

const { globalMenu } = adminLayoutConfig;

const sidebarContainer = cva("h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-lg");

const submenuVariants = cva(
  "modal-layer absolute top-0 rounded bg-sidebar shadow-xl ring-1 ring-sidebar-border/60 transition-all duration-200",
  {
    variants: {
      open: {
        true: "opacity-100 translate-x-0 pointer-events-auto",
        false: "opacity-0 translate-x-2 pointer-events-none",
      },
      placement: {
        right: "left-full -ml-2",
        left: "right-full -mr-2",
      },
      size: {
        default: "w-48 flex flex-col gap-1",
        compact: "w-44 flex flex-col gap-0.5",
      },
    },
    defaultVariants: { open: false, placement: "right", size: "default" },
  },
);

const itemLink = cva(
  "block rounded transition-colors duration-200 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
  {
    variants: {
      size: {
        default: "px-4 py-4 text-sm",
        compact: "px-3 py-3.5 text-xs",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type BaseSidebarProps = {
  width?: number;
  onNavigate?: () => void;
  submenuPlacement?: "left" | "right";
  submenuVariant?: "default" | "compact";
};

export function BaseSidebar({
  width = 192,
  onNavigate,
  submenuPlacement = "right",
  submenuVariant = "default",
}: BaseSidebarProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { logout, isLoading } = useLogout({ redirectTo: "/admin/login" });
  const { showToast } = useToast();
  // メニューの中身(受け口のカテゴリーと項目。ロールと門番で絞り、行の無いカテゴリーは来ない)
  const categories = useAdminMenu();

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
    }, globalMenu.submenuHideDelayMs);
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
      showToast("ログアウトしました", "success");
    } catch (error) {
      showToast(err(error, "ログアウトに失敗しました"), "error");
    }
  }, [logout, onNavigate, showToast]);

  const focusIndex = (index: number) => {
    clearCloseTimeout();
    setOpenIndex(index);
  };

  return (
    <aside style={{ width }} className={cn(sidebarContainer(), "flex flex-col")}>
      <Stack space={2} className="w-full mb-0">
        <nav aria-label="管理メニュー" className="w-full">
          <ul className="flex w-full flex-col p-0 list-none m-0">
            <li className="relative w-full">
              <MenuButton asChild>
                <Link
                  href={ADMIN_HOME_LINK.href}
                  onClick={() => {
                    closeSubmenuImmediately();
                    onNavigate?.();
                  }}
                >
                  {ADMIN_MENU_ICONS_ENABLED && <ADMIN_HOME_LINK.icon className="size-4 shrink-0" />}
                  {ADMIN_HOME_LINK.label}
                </Link>
              </MenuButton>
            </li>
            {categories.map((category, i) => {
              const isOpen = openIndex === i;

              return (
                <li
                  key={category.key}
                  className="relative w-full group"
                  onMouseEnter={() => {
                    clearCloseTimeout();
                    setOpenIndex(i);
                  }}
                  onMouseLeave={() => {
                    scheduleClose();
                  }}
                >
                  <Span
                    tabIndex={0}
                    role="menuitem"
                    aria-haspopup
                    aria-expanded={isOpen}
                    onFocus={() => focusIndex(i)}
                    onClick={() => focusIndex(i)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        focusIndex(i);
                      }
                    }}
                    className={cn(
                      adminSidebarButtonClassName,
                      "cursor-default outline-none focus-visible:bg-sidebar-primary focus-visible:text-sidebar-primary-foreground",
                    )}
                  >
                    {ADMIN_MENU_ICONS_ENABLED && category.icon && <category.icon className="size-4 shrink-0" />}
                    {category.label}
                  </Span>
                  <ul
                    className={cn(
                      submenuVariants({
                        open: isOpen,
                        placement: submenuPlacement,
                        size: submenuVariant,
                      }),
                      "list-none m-0",
                    )}
                  >
                    {category.rows.map((row) => (
                      <li key={row.key}>
                        <Link
                          href={row.href}
                          className={cn(itemLink({ size: submenuVariant }), "w-full flex items-center gap-2")}
                          onClick={() => {
                            closeSubmenuImmediately();
                            onNavigate?.();
                          }}
                        >
                          {ADMIN_MENU_ICONS_ENABLED && row.icon && <row.icon className="size-4 shrink-0" />}
                          {row.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>
      </Stack>
      <Stack space={2} className="w-full mt-0">
        <MenuButton asChild>
          <Link href={ADMIN_SITE_LINK.href} onClick={() => onNavigate?.()}>
            {ADMIN_MENU_ICONS_ENABLED && <ADMIN_SITE_LINK.icon className="size-4 shrink-0" />}
            {ADMIN_SITE_LINK.label}
          </Link>
        </MenuButton>
        <div className="group relative w-full">
          <MenuButton type="button" onClick={handleLogout} disabled={isLoading}>
            {ADMIN_MENU_ICONS_ENABLED && <ADMIN_LOGOUT_ICON className="size-4 shrink-0" />}
            ログアウト
          </MenuButton>
        </div>
      </Stack>
    </aside>
  );
}
