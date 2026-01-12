// src/app/admin/layout.tsx

import type { ReactNode } from "react";

import { AdminOuterLayout } from "@/components/AppFrames/Admin/Layout/AdminOuterLayout";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <AdminOuterLayout>{children}</AdminOuterLayout>;
}
