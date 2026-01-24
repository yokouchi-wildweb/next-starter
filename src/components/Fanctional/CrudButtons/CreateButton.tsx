// src/components/Fanctional/CreateButton.tsx

"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

export type CreateButtonProps = {
  href: string;
  /** ボタンラベル @default "新規作成" */
  label?: string;
};

export default function CreateButton({ href, label = "新規作成" }: CreateButtonProps) {
  return (
    <Button asChild>
      <Link href={href} style={{ gap: "0.15rem" }}>
        <Plus className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
