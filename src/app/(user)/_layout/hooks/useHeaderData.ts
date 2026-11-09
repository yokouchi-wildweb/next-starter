/**
 * カスタムヘッダー用のデータ・状態を提供するフック
 *
 * 設定: 枠の設定 ../config.ts の header(値)と ../config.ui.ts の header(メニュー項目・ログアウトのアイコン)
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

import { userLayoutConfig } from "../config";
import { userLayoutUiConfig } from "../config.ui";
import type { NavigationMenuItem } from "../Header/types";

// ============================================
// 型定義
// ============================================

/** ナビゲーションメニューアイテム（Header/types.ts の再エクスポート） */
export type HeaderNavItem = NavigationMenuItem;

/** SP/PC表示設定 */
export type DeviceVisibility = {
  readonly sp: boolean;
  readonly pc: boolean;
};

/** useHeaderData の戻り値 */
export type UseHeaderDataReturn = {
  /** ナビゲーションメニュー項目（認証状態反映済み） */
  navItems: HeaderNavItem[];
  /** ロゴのリンク先 */
  logoLink: string;
  /** メニューにアイコンを表示するか */
  showIcons: boolean;
  /** メニューの開閉状態 */
  isMenuOpen: boolean;
  /** メニューを開く */
  openMenu: () => void;
  /** メニューを閉じる */
  closeMenu: () => void;
  /** メニューの開閉をトグル */
  toggleMenu: () => void;
  /** ヘッダー要素のref（高さ計算用） */
  headerRef: React.RefObject<HTMLElement | null>;
  /** ヘッダーの高さ（px） */
  headerOffset: number;
};

// ============================================
// フック実装
// ============================================

export const useHeaderData = (): UseHeaderDataReturn => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  // 認証・ログアウト
  const { isAuthenticated } = useAuthSession();
  const { logout, isLoading: isLogoutLoading } = useLogout({
    redirectTo: userLayoutConfig.header.logout.redirectTo,
  });

  // メニュー開閉
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  // パス変更時にメニューを閉じる(前回の render の pathname と比べて render 中に調整する)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMenuOpen(false);
  }

  // PCサイズになったらメニューを閉じる
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleResize = () => {
      if (window.innerWidth >= 640) {
        closeMenu();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [closeMenu, isMenuOpen]);

  // ヘッダー高さの計算
  useEffect(() => {
    const element = headerRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setHeaderOffset(element.offsetHeight);
    };

    updateHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateHeight)
        : null;
    resizeObserver?.observe(element);

    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  // メニューオープン時のスクロール制御
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  // ナビゲーションメニュー項目
  const navItems = useMemo<HeaderNavItem[]>(() => {
    const baseItems: HeaderNavItem[] = isAuthenticated
      ? [...userLayoutUiConfig.header.authenticatedMenuItems]
      : [...userLayoutUiConfig.header.guestMenuItems];

    // ログアウトボタンを追加（認証済み＆フラグONの場合）
    if (isAuthenticated && userLayoutConfig.header.logout.show) {
      baseItems.push({
        key: "logout",
        label: userLayoutConfig.header.logout.label,
        onClick: () => void logout(),
        disabled: isLogoutLoading,
        icon: userLayoutUiConfig.header.logout.icon,
      });
    }

    return baseItems;
  }, [isAuthenticated, isLogoutLoading, logout]);

  return {
    navItems,
    logoLink: userLayoutConfig.header.logoLink,
    showIcons: userLayoutConfig.header.menuIconsEnabled,
    isMenuOpen,
    openMenu,
    closeMenu,
    toggleMenu,
    headerRef,
    headerOffset,
  };
};
