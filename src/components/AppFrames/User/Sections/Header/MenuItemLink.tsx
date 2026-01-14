/**
 * メニューアイテムのリンク/非リンク切り替えコンポーネント
 *
 * href があれば Next.js Link、なければ span を返す
 * PC/SP共通で使用
 */

import Link from "next/link";

export type MenuItemLinkProps = {
  readonly href?: string | null;
  readonly className: string;
  readonly onClick?: (e: React.MouseEvent) => void;
  readonly children: React.ReactNode;
};

export const MenuItemLink = ({ href, className, onClick, children }: MenuItemLinkProps) => {
  const normalizedHref = href ?? undefined;
  const hasLink = normalizedHref != null && normalizedHref !== "";

  if (hasLink) {
    return (
      <Link href={normalizedHref} onClick={onClick} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <span className={className} onClick={onClick}>
      {children}
    </span>
  );
};
