// src/lib/crud/components/Buttons/CreateButton.tsx

"use client";

import { Link } from "@/components/Navigation/Link";
import { Plus, type LucideIcon } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { type ButtonStyleProps } from "@/components/Button/variants";
import type { DomainDisplay } from "@/lib/domain";
import { getAdminPaths } from "@/lib/domain";

export type CreateButtonProps = ButtonStyleProps & {
  /** ドメインの表示用の写し（<domain>/entities/display.ts の domainDisplay） */
  domain?: DomainDisplay;
  /** ボタンラベル @default "新規作成" */
  label?: string;
  /** ボタンアイコン @default Plus */
  icon?: LucideIcon;
  /** カスタムhref（省略時は管理画面の新規作成パスを自動生成） */
  href?: string;
  /** 押した時の処理（モーダルで作る一覧など）。渡すとリンクではなくボタンになり、domain / href は使わない */
  onClick?: () => void;
  /** 押せなくする(onClick の時だけ) */
  disabled?: boolean;
};

export function CreateButton({
  domain,
  label = "新規作成",
  icon: Icon = Plus,
  href,
  size = "md",
  variant = "primary",
  onClick,
  disabled,
}: CreateButtonProps) {
  if (onClick) {
    return (
      <Button type="button" size={size} variant={variant} onClick={onClick} disabled={disabled} style={{ gap: "0.15rem" }}>
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    );
  }

  // hrefが直接指定されていればそれを使用、なければdomainから生成
  const resolvedHref = href ?? (() => {
    if (!domain) {
      throw new Error("CreateButton: domain または href のどちらかを指定してください");
    }
    const paths = getAdminPaths(domain.plural);
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
