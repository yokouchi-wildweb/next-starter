/**
 * PC用メニューアイテム
 *
 * ドロップダウン対応
 */

import { ChevronDown } from "lucide-react";

import { MenuItemLabel } from "../MenuItemLabel";
import { MenuItemLink } from "../MenuItemLink";
import { hasChildren, isActionItem } from "../types";
import type { NavigationMenuItem } from "../types";

export type PcMenuItemProps = {
  readonly item: NavigationMenuItem;
  readonly showIcon?: boolean;
  readonly isDropdownChild?: boolean;
  readonly onNavigate?: () => void;
};

const styles = {
  link: "flex items-center px-4 transition-colors hover:text-primary disabled:opacity-60",
  trigger: "flex items-center gap-1 px-4 transition-colors hover:text-primary cursor-pointer",
  dropdownItem: "block w-full px-4 py-4 text-left text-sm transition-colors hover:bg-muted hover:text-primary",
} as const;

export const PcMenuItem = ({
  item,
  showIcon = true,
  isDropdownChild = false,
  onNavigate,
}: PcMenuItemProps) => {
  // 子メニューありの場合はドロップダウン
  if (hasChildren(item)) {
    return (
      <div id={`header-pc-menu-${item.key}`} className="group relative flex items-stretch">
        <PcMenuItemContent
          item={item}
          className={styles.trigger}
          showIcon={showIcon}
          showChevron
          onNavigate={onNavigate}
        />
        <div id={`header-pc-dropdown-${item.key}`} className="invisible absolute left-0 top-full z-50 min-w-40 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
          <ul id={`header-pc-dropdown-list-${item.key}`} className="rounded-md border border-border bg-popover py-1 shadow-lg">
            {item.children?.map((child) => (
              <li key={child.key} id={`header-pc-dropdown-item-${child.key}`}>
                <PcMenuItem
                  item={child}
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
  if (isActionItem(item)) {
    const handleClick = () => {
      onNavigate?.();
      item.onClick?.();
    };

    return (
      <button
        id={`header-pc-action-${item.key}`}
        type="button"
        onClick={handleClick}
        disabled={item.disabled}
        className={styles.link}
      >
        <MenuItemLabel label={item.label} icon={item.icon} showIcon={showIcon} />
      </button>
    );
  }

  // ドロップダウン内の子アイテムか通常アイテムかでクラスを切り替え
  const linkClassName = isDropdownChild ? styles.dropdownItem : styles.link;
  const itemId = isDropdownChild ? `header-pc-dropdown-link-${item.key}` : `header-pc-link-${item.key}`;

  return (
    <PcMenuItemContent
      item={item}
      className={linkClassName}
      showIcon={showIcon}
      onNavigate={onNavigate}
      id={itemId}
    />
  );
};

// 内部コンポーネント: リンクありなしで統一された構造を提供
type PcMenuItemContentProps = {
  readonly item: NavigationMenuItem;
  readonly className: string;
  readonly showIcon?: boolean;
  readonly showChevron?: boolean;
  readonly onNavigate?: () => void;
  readonly id?: string;
};

const PcMenuItemContent = ({
  item,
  className,
  showIcon = true,
  showChevron = false,
  onNavigate,
  id,
}: PcMenuItemContentProps) => {
  const content = (
    <>
      <MenuItemLabel label={item.label} icon={item.icon} showIcon={showIcon} />
      {showChevron && <ChevronDown className="size-4 transition-transform group-hover:rotate-180" />}
    </>
  );

  return (
    <MenuItemLink href={item.href} className={className} onClick={onNavigate} id={id}>
      {content}
    </MenuItemLink>
  );
};
