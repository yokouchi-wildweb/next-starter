// src/components/Admin/Sections/BaseSidebar/BaseSidebar.tsx

"use client";

import Link from "next/link";
import { cva } from "class-variance-authority";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useLogout } from "@/features/core/auth/hooks/useLogout";
import { cn } from "@/lib/cn";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { adminMenu, type AdminMenuSection } from "@/config/ui/admin-global-menu.config";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import { MenuButton, adminSidebarButtonClassName } from "./MenuButton";

const [{ adminGlobalMenu }] = UI_BEHAVIOR_CONFIG;

const sidebarContainer = cva(
  "h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-lg",
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

/**
 * メニュー設定からサイドバー用のセクションリストを生成
 * allowRoles が指定されている場合、ユーザーロールでフィルタリング
 */
function buildSidebarSections(
  menu: AdminMenuSection[],
  userRole: string | undefined,
): SidebarMenuSection[] {
  return menu
    .filter((section) => {
      // allowRoles 未指定は全員表示
      if (!section.allowRoles || section.allowRoles.length === 0) {
        return true;
      }
      // ユーザーロールが allowRoles に含まれているか
      return userRole ? section.allowRoles.includes(userRole) : false;
    })
    .map((section) => {
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
}

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
  const { user } = useAuthSession();

  // ユーザーロールに基づいてメニューをフィルタリング
  const sidebarSections = useMemo(
    () => buildSidebarSections(adminMenu, user?.role),
    [user?.role],
  );

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
                    <MenuButton asChild>
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
                    </MenuButton>
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
                        "cursor-default outline-none focus-visible:bg-sidebar-primary focus-visible:text-sidebar-primary-foreground",
                      )}
                    >
                      {section.title}
                    </Span>
                  )}
                  {hasSubMenu && (
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
                      {section.items.map((item) => (
                        <li key={`${section.title}-${item.title}`}>
                          <Link
                            href={item.href}
                            className={cn(itemLink({ size: submenuVariant }), "w-full")}
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
      </Stack>
      <Stack space={2} className="w-full mt-0">
        <div className="group relative w-full">
          <MenuButton type="button" onClick={handleLogout} disabled={isLoading}>
            ログアウト
          </MenuButton>
        </div>
      </Stack>
    </aside>
  );
}
