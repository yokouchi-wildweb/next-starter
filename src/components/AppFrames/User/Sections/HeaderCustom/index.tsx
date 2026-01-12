/**
 * カスタムヘッダー スケルトンテンプレート
 *
 * このファイルを編集してプロジェクト固有のヘッダーを作成してください。
 * useHeaderData フックにより、設定ファイルからのデータ取得や
 * 認証状態の判定などのロジックは全て提供されます。
 *
 * 使用方法:
 * 1. このファイルを編集してデザインをカスタマイズ
 * 2. src/config/ui/user-header.config.ts の export を切り替え:
 *    export { UserNavigation } from "@/components/AppFrames/User/Sections/HeaderCustom";
 */

"use client";

import Link from "next/link";

import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { useHeaderData, type HeaderNavItem } from "../../hooks";

export const UserNavigation = () => {
  const {
    enabled,
    navItems,
    navEnabled,
    navVisibility,
    logoLink,
    isMenuOpen,
    closeMenu,
    toggleMenu,
    headerRef,
    headerOffset,
    visibilityClass,
  } = useHeaderData();

  // ヘッダー自体が無効の場合は何も表示しない
  if (!enabled) {
    return null;
  }

  return (
    <header
      id={APP_HEADER_ELEMENT_ID}
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-50 border-b border-border bg-background ${visibilityClass}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        {/* ロゴ */}
        <Link href={logoLink} className="text-xl font-bold">
          Logo
        </Link>

        {/* PC: ナビゲーション */}
        {navEnabled.pc && navVisibility.pc && (
          <nav className="hidden items-center gap-6 sm:flex">
            {navItems.map((item) => (
              <NavItem key={item.key} item={item} />
            ))}
          </nav>
        )}

        {/* SP: ハンバーガーボタン */}
        {navEnabled.sp && navVisibility.sp && (
          <button
            type="button"
            onClick={toggleMenu}
            className="flex size-10 items-center justify-center sm:hidden"
            aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
          >
            <span className="text-2xl">{isMenuOpen ? "✕" : "☰"}</span>
          </button>
        )}
      </div>

      {/* SP: モバイルメニュー */}
      {navEnabled.sp && navVisibility.sp && isMenuOpen && (
        <nav
          className="fixed inset-x-0 bottom-0 overflow-y-auto bg-background sm:hidden"
          style={{ top: headerOffset }}
        >
          <div className="flex flex-col p-4">
            {navItems.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                variant="mobile"
                onNavigate={closeMenu}
              />
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

// ============================================
// サブコンポーネント（必要に応じてカスタマイズ）
// ============================================

type NavItemProps = {
  item: HeaderNavItem;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
};

function NavItem({ item, variant = "desktop", onNavigate }: NavItemProps) {
  const isAction = typeof item.onClick === "function";
  const baseClass =
    variant === "desktop"
      ? "text-sm transition-colors hover:text-primary"
      : "block py-3 text-base transition-colors hover:text-primary";

  if (isAction) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          item.onClick?.();
        }}
        disabled={item.disabled}
        className={baseClass}
      >
        {item.label}
      </button>
    );
  }

  if (!item.href) {
    return <span className={baseClass}>{item.label}</span>;
  }

  return (
    <Link href={item.href} onClick={onNavigate} className={baseClass}>
      {item.label}
    </Link>
  );
}
