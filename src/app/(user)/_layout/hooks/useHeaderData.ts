/**
 * カスタムヘッダー用のデータ・状態を提供するフック
 *
 * 3 つに分かれる(既定のヘッダー ../Header は分けて使い、枠の殻に入る部分で request を読まない):
 * - useHeaderMenu: メニューの開閉・ヘッダーの要素と高さ(request を読まない)
 * - useHeaderNavItems: メニュー項目(セッションで変わる。Suspense の内側で読む)
 * - useCloseMenuOnNavigate: 住所が変わったらメニューを閉じる(URL を読む。Suspense の内側で読む)
 * useHeaderData = 3 つを合わせた今までの形(カスタムヘッダー用。UserLayout の header slot の要素は枠の部位の包みの Suspense の内側に入る)
 *
 * 設定: 枠の設定 ../config.ts の header(値)と ../config.ui.ts の header(メニュー項目・ログアウトのアイコン)
 * 差した項目: 点 userMenuItems(menu "header")を設定の項目に重ねる(ログアウトの前)
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useFrameSession } from "@/app/_layout/useFrameSession";

import { userLayoutConfig } from "../config";
import { userLayoutUiConfig } from "../config.ui";
import type { NavigationMenuItem } from "../Header/types";
import { mergeMenuItems } from "./mergeMenuItems";
import { usePluggedMenuItems } from "./usePluggedMenuItems";

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

/** メニューの開閉・ヘッダーの要素と高さ(request を読まない) */
export type UseHeaderMenuReturn = Omit<UseHeaderDataReturn, "navItems">;

export const useHeaderData = (): UseHeaderDataReturn => {
  const menu = useHeaderMenu();
  const navItems = useHeaderNavItems();
  const pathname = usePathname();

  // パス変更時にメニューを閉じる(前回の render の pathname と比べて render 中に調整する)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    menu.closeMenu();
  }

  return { navItems, ...menu };
};

/**
 * 住所が変わったらメニューを閉じる(URL を読むので、既定のヘッダーは Suspense の内側の何も描かない子で呼ぶ)。
 * 親(メニューの状態の持ち主)の state を変えるので render 中ではなく effect で(最初の住所では閉じない)
 */
export const useCloseMenuOnNavigate = (closeMenu: () => void): void => {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    closeMenu();
  }, [pathname, closeMenu]);
};

/** メニューの開閉・ヘッダーの要素と高さ。request を読まない(枠の殻に入る部分で使える) */
export const useHeaderMenu = (): UseHeaderMenuReturn => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);

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

  return {
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

/** ナビゲーションメニュー項目(設定の項目 + 差した項目 + ログアウト)。セッションで変わる(Suspense の内側で読む) */
export const useHeaderNavItems = (): HeaderNavItem[] => {
  // 認証・ログアウト(点 frameSession の項目、上流は auth。枠はドメインを読まない)
  const session = useFrameSession();
  const { isAuthenticated } = session.useSession();
  const { logout, isLoading: isLogoutLoading } = session.useLogout({
    redirectTo: userLayoutConfig.header.logout.redirectTo,
  });

  const plugged = usePluggedMenuItems("header");
  const navItems = useMemo<HeaderNavItem[]>(() => {
    const baseItems: HeaderNavItem[] = mergeMenuItems<HeaderNavItem>(
      isAuthenticated ? userLayoutUiConfig.header.authenticatedMenuItems : userLayoutUiConfig.header.guestMenuItems,
      plugged,
      isAuthenticated,
    );

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
  }, [isAuthenticated, isLogoutLoading, logout, plugged]);

  return navItems;
};
