// src/lib/crud/components/Buttons/CreateButton.tsx

"use client";

import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { getDomainConfig } from "@/lib/domain";
import { getAdminPaths } from "@/lib/crud/utils";

export type CreateButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式）。hrefを直接指定する場合は省略可 */
  domain?: string;
  /** ボタンラベル @default "新規作成" */
  label?: string;
  /** ボタンアイコン @default Plus */
  icon?: LucideIcon;
  /** カスタムhref（省略時は管理画面の新規作成パスを自動生成） */
  href?: string;
};

export function CreateButton({
  domain,
  label = "新規作成",
  icon: Icon = Plus,
  href,
  size = "md",
  variant = "primary",
}: CreateButtonProps) {
  // hrefが直接指定されていればそれを使用、なければdomainから生成
  const resolvedHref = href ?? (() => {
    if (!domain) {
      throw new Error("CreateButton: domain または href のどちらかを指定してください");
    }
    const config = getDomainConfig(domain);
    const paths = getAdminPaths(config.plural);
    return paths.new;
  })();

  return (
    <Button asChild size={size} variant={variant}>
      <Link href={resolvedHref} style={{ gap: "0.15rem" }}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
