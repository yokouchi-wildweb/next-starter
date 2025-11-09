// src/components/Admin/AdminListHeader.tsx

"use client";

import Link from "next/link";

import { SecTitle } from "@/components/TextBlocks";
import { Button } from "@/components/Form/button/Button";

type Props = {
  title: string;
  newHref?: string;
  children?: React.ReactNode;
};

export default function AdminListHeader({ title, newHref, children }: Props) {
  return (
    <div className="flex justify-between items-center gap-2">
      <SecTitle variant="barAccent" as="h2">
        {title}
      </SecTitle>
      <div className="flex items-center gap-2">
        {children}
        {newHref && (
          <Button asChild>
            <Link href={newHref}>新規作成</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
