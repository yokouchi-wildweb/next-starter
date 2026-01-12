/**
 * カスタムヘッダー用のデータ・状態を提供するフック
 *
 * 設定ファイル: src/config/ui/user-header.config.ts
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  AUTHENTICATED_MENU_ITEMS,
  GUEST_MENU_ITEMS,
  HEADER_ENABLED,
  HEADER_LOGO_LINK,
  HEADER_NAV_ENABLED,
  LOGOUT_LABEL,
  LOGOUT_REDIRECT_TO,
  SHOW_LOGOUT_BUTTON,
} from "@/config/ui/user-header.config";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

import { useHeaderVisibility } from "../contexts/HeaderVisibilityContext";
import { useHeaderNavVisibility } from "../contexts/HeaderNavVisibilityContext";

// ============================================
// 型定義
// ============================================

/** ナビゲーションメニューアイテム */
export type HeaderNavItem = {
  readonly key: string;
  readonly label: string;
  readonly href?: string | null;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
};

/** SP/PC表示設定 */
export type DeviceVisibility = {
  readonly sp: boolean;
  readonly pc: boolean;
};

/** useHeaderData の戻り値 */
export type UseHeaderDataReturn = {
  /** ヘッダー機能が有効か */
  enabled: boolean;
  /** ナビゲーションメニュー項目（認証状態反映済み） */
  navItems: HeaderNavItem[];
  /** ナビメニューの有効設定（SP/PC） */
  navEnabled: DeviceVisibility;
  /** ヘッダーの表示状態（SP/PC） */
  visibility: DeviceVisibility;
  /** ナビメニューの表示状態（SP/PC） */
  navVisibility: DeviceVisibility;
  /** ロゴのリンク先 */
  logoLink: string;
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
  /** SP/PC両方の表示クラス */
  visibilityClass: string;
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
    redirectTo: LOGOUT_REDIRECT_TO,
  });

  // Context からの表示状態
  const { visibility } = useHeaderVisibility();
  const { visibility: navVisibility } = useHeaderNavVisibility();

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

  // パス変更時にメニューを閉じる
  useEffect(() => {
    closeMenu();
  }, [closeMenu, pathname]);

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
      ? [...AUTHENTICATED_MENU_ITEMS]
      : [...GUEST_MENU_ITEMS];

    // ログアウトボタンを追加（認証済み＆フラグONの場合）
    if (isAuthenticated && SHOW_LOGOUT_BUTTON) {
      baseItems.push({
        key: "logout",
        label: LOGOUT_LABEL,
        onClick: () => void logout(),
        disabled: isLogoutLoading,
      });
    }

    return baseItems;
  }, [isAuthenticated, isLogoutLoading, logout]);

  // 表示/非表示のクラスを決定
  const visibilityClass = useMemo(() => {
    if (!visibility.sp && !visibility.pc) return "hidden";
    if (!visibility.sp && visibility.pc) return "hidden sm:block";
    if (visibility.sp && !visibility.pc) return "block sm:hidden";
    return "";
  }, [visibility.sp, visibility.pc]);

  return {
    enabled: HEADER_ENABLED,
    navItems,
    navEnabled: HEADER_NAV_ENABLED,
    visibility,
    navVisibility,
    logoLink: HEADER_LOGO_LINK,
    isMenuOpen,
    openMenu,
    closeMenu,
    toggleMenu,
    headerRef,
    headerOffset,
    visibilityClass,
  };
};
