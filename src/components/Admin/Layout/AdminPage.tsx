// src/components/Admin/layout/AdminPage.tsx

import { Main } from "@/components/TextBlocks";

type Props = {
  children: React.ReactNode;
  variant?: "default" | "dashboard";
};

export default function AdminPage({ children, variant = "default" }: Props) {
  const baseClassName = "p-6";
  const variantClassName =
    variant === "dashboard" ? "grid gap-6" : "space-y-6";
  const className = `${baseClassName} ${variantClassName}`;

  return (
    <Main containerType="plain" className={className}>
      {children}
    </Main>
  );
}
