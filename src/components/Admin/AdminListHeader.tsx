// src/components/Admin/AdminListHeader.tsx

"use client";

import Link from "next/link";

import AdminSecTitle from "@/components/Admin/Layout/AdminSecTitle";
import { Button } from "@/components/Form/Button/Button";

type Props = {
  title: string;
  newHref?: string;
  children?: React.ReactNode;
};

export default function AdminListHeader({ title, newHref, children }: Props) {
  return (
    <div className="flex justify-between items-center gap-2">
      <AdminSecTitle>
        {title}
      </AdminSecTitle>
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
