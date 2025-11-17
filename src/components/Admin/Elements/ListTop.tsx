// src/components/Admin/Elements/ListTop.tsx

"use client";

import Link from "next/link";

import SecTitle from "@/components/Admin/Elements/SecTitle";
import { Button } from "@/components/Form/Button/Button";

type Props = {
  title: string;
  newHref?: string;
  children?: React.ReactNode;
};

export default function ListTop({ title, newHref, children }: Props) {
  return (
    <div id="admin-list-top" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SecTitle>
        {title}
      </SecTitle>
      <div className="flex items-center gap-2 overflow-x-auto">
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
