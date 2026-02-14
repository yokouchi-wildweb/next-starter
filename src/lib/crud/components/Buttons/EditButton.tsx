// src/lib/crud/components/Buttons/EditButton.tsx

"use client";

import Link from "next/link";
import { Pencil, type LucideIcon } from "lucide-react";
import { useSearchParams, usePathname } from "next/navigation";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { getDomainConfig } from "@/lib/domain";
import { getAdminPaths } from "@/lib/crud/utils";

export type EditButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式）。hrefを直接指定する場合は省略可 */
  domain?: string;
  /** 編集対象のID。hrefを直接指定する場合は省略可 */
  id?: string;
  /** ボタンラベル @default "編集" */
  label?: string;
  /** ボタンアイコン @default Pencil */
  icon?: LucideIcon;
  /** カスタムhref（省略時は管理画面の編集パスを自動生成） */
  href?: string;
};

export function EditButton({
  domain,
  id,
  label = "編集",
  icon: Icon = Pencil,
  href,
  size = "sm",
  variant = "outline",
}: EditButtonProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // hrefが直接指定されていればそれを使用、なければdomain/idから生成
  const resolvedHref = href ?? (() => {
    if (!domain || !id) {
      throw new Error("EditButton: domain/id または href のどちらかを指定してください");
    }
    const config = getDomainConfig(domain);
    const paths = getAdminPaths(config.plural);
    return paths.edit(id);
  })();

  // 現在のURL（検索パラメータ含む）をreturnToとして付与
  const currentUrl = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;
  const separator = resolvedHref.includes("?") ? "&" : "?";
  const hrefWithReturn = `${resolvedHref}${separator}returnTo=${encodeURIComponent(currentUrl)}`;

  return (
    <Button asChild size={size} variant={variant}>
      <Link href={hrefWithReturn}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
