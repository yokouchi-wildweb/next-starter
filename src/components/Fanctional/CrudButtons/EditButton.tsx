// src/components/Fanctional/EditButton.tsx

"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

export type EditButtonProps = {
  href: string;
  /** ボタンラベル @default "編集" */
  label?: string;
};

export default function EditButton({ href, label = "編集" }: EditButtonProps) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        <Pencil className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
