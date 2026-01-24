// src/lib/crud/components/Buttons/EditButton.tsx

"use client";

import Link from "next/link";
import { Pencil, type LucideIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { getDomainConfig } from "@/lib/domain";
import { getAdminPaths } from "@/lib/crud/utils";

export type EditButtonProps = {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 編集対象のID */
  id: string;
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
}: EditButtonProps) {
  const config = getDomainConfig(domain);
  const paths = getAdminPaths(config.plural);
  const resolvedHref = href ?? paths.edit(id);

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={resolvedHref}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
