// src/components/UserAppLayout/Header/MenuItem.tsx

import Link from "next/link";

import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationMenuItem = {
  readonly key: string;
  readonly label: string;
  readonly href?: string | null;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly icon?: LucideIcon;
  readonly children?: NavigationMenuItem[];
};

export type NavigationItemProps = {
  readonly item: NavigationMenuItem;
  readonly variant: "desktop" | "mobile";
  readonly showIcon?: boolean;
  readonly isDropdownChild?: boolean;
  readonly onNavigate?: () => void;
};

const pcClassName = {
  link: "flex items-center px-4 transition-colors hover:text-primary disabled:opacity-60",
  // リンクありなしで同じスタイルを適用するための共通クラス
  trigger: "flex items-center gap-1 px-4 transition-colors hover:text-primary cursor-pointer",
  // ドロップダウン内の子アイテム用
  dropdownItem: "block w-full px-4 py-4 text-left text-sm transition-colors hover:bg-muted hover:text-primary",
} as const;

const spClassName = {
  action:
    "h-auto w-full justify-start px-3 py-2 text-left transition-colors hover:bg-muted hover:text-primary disabled:opacity-60",
  link: "block rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-primary",
  trigger: "flex w-full items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-primary cursor-pointer",
} as const;

export const MenuItem = ({
  item,
  variant,
  showIcon = true,
  isDropdownChild = false,
  onNavigate,
}: NavigationItemProps) => {
  const isActionItem = typeof item.onClick === "function";
  const classNameMap = variant === "desktop" ? pcClassName : spClassName;
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;

  // アイコン付きラベルのレンダリング
  const renderLabel = () => (
    <span className="inline-flex items-center gap-1.5">
      {showIcon && Icon && <Icon className="size-4" />}
      {item.label}
    </span>
  );

  // PC版: 子メニューありの場合はドロップダウン
  if (variant === "desktop" && hasChildren) {
    return (
      <div className="group relative flex items-stretch">
        <MenuItemContent
          item={item}
          className={classNameMap.trigger}
          showIcon={showIcon}
          showChevron
          onNavigate={onNavigate}
        />
        <div className="invisible absolute left-0 top-full z-50 min-w-40 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
          <ul className="rounded-md border border-border bg-popover py-1 shadow-lg">
            {item.children?.map((child) => (
              <li key={child.key}>
                <MenuItem
                  item={child}
                  variant="desktop"
                  showIcon={showIcon}
                  isDropdownChild
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // アクション（onClick）の場合
  if (isActionItem) {
    const handleClick = () => {
      onNavigate?.();
      item.onClick?.();
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={item.disabled}
        className={classNameMap.link}
      >
        {renderLabel()}
      </button>
    );
  }

  // ドロップダウン内の子アイテムか通常アイテムかでクラスを切り替え
  const linkClassName =
    variant === "desktop" && isDropdownChild ? pcClassName.dropdownItem : classNameMap.link;

  // 通常のリンク/非リンクアイテム
  return (
    <MenuItemContent
      item={item}
      className={linkClassName}
      showIcon={showIcon}
      onNavigate={onNavigate}
    />
  );
};

// 内部コンポーネント: リンクありなしで統一された構造を提供
type MenuItemContentProps = {
  readonly item: NavigationMenuItem;
  readonly className: string;
  readonly showIcon?: boolean;
  readonly showChevron?: boolean;
  readonly onNavigate?: () => void;
};

const MenuItemContent = ({
  item,
  className,
  showIcon = true,
  showChevron = false,
  onNavigate,
}: MenuItemContentProps) => {
  const Icon = item.icon;
  const href = item.href ?? undefined;
  const hasLink = href != null && href !== "";

  const content = (
    <>
      <span className="inline-flex items-center gap-1.5">
        {showIcon && Icon && <Icon className="size-4" />}
        {item.label}
      </span>
      {showChevron && <ChevronDown className="size-4 transition-transform group-hover:rotate-180" />}
    </>
  );

  if (hasLink) {
    return (
      <Link href={href} onClick={onNavigate} className={className}>
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
};
