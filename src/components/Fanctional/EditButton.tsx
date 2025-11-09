// src/components/Common/EditButton.tsx

"use client";

import Link from "next/link";
import { Button } from "@/components/Form/button/Button";

export type EditButtonProps = {
  href: string;
  /** Stop event propagation on click */
  stopPropagation?: boolean;
};

export default function EditButton({ href, stopPropagation }: EditButtonProps) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href} onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
        編集
      </Link>
    </Button>
  );
}
