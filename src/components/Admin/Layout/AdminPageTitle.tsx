// src/components/Admin/layout/AdminPageTitle.tsx

import type { ReactNode } from "react";

import { PageTitle } from "@/components/TextBlocks";

type Props = {
  children: ReactNode;
};

export default function AdminPageTitle({ children }: Props) {
  return <PageTitle className="admin-page-title">{children}</PageTitle>;
}
