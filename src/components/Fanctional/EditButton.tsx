// src/components/Common/EditButton.tsx

"use client";

import Link from "next/link";
import { Button } from "@/components/Form/Button/Button";

export type EditButtonProps = {
  href: string;
  /** Stop event propagation on click */
  stopPropagation?: boolean;
  /** Button label */
  label?: string;
};

export default function EditButton({
  href,
  stopPropagation,
  label = "編集",
}: EditButtonProps) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href} onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
        {label}
      </Link>
    </Button>
  );
}
