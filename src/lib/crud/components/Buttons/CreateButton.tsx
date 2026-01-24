// src/lib/crud/components/Buttons/CreateButton.tsx

"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { getDomainConfig } from "@/lib/domain";
import { getAdminPaths } from "@/lib/crud/utils";

export type CreateButtonProps = {
  /** ドメイン名（singular形式） */
  domain: string;
  /** ボタンラベル @default "新規作成" */
  label?: string;
  /** カスタムhref（省略時は管理画面の新規作成パスを自動生成） */
  href?: string;
};

export function CreateButton({
  domain,
  label = "新規作成",
  href,
}: CreateButtonProps) {
  const config = getDomainConfig(domain);
  const paths = getAdminPaths(config.plural);
  const resolvedHref = href ?? paths.new;

  return (
    <Button asChild>
      <Link href={resolvedHref} style={{ gap: "0.15rem" }}>
        <Plus className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
