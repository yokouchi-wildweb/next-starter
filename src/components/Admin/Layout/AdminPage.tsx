// src/components/Admin/layout/AdminPage.tsx

import { Main } from "@/components/TextBlocks";

type Props = {
  children: React.ReactNode;
  variant?: "default" | "dashboard";
};

export default function AdminPage({ children, variant = "default" }: Props) {
  const className =
    variant === "dashboard"
      ? "admin-page admin-page-dashboard"
      : "admin-page admin-page-default";

  return <Main variant="plain" className={className}>{children}</Main>;
}
