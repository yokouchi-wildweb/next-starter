// src/app/(user)/(protected)/layout.tsx

import type { ReactNode } from "react";

import { authGuard } from "@/features/core/auth/services/server/authorization";

export default async function UserProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await authGuard({ allowRoles: ["admin", "user"], redirectTo: "/login" });

  return <>{children}</>;
}
