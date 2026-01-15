// src/app/(user)/(protected)/layout.tsx

import type { ReactNode } from "react";

import { authGuard } from "@/features/core/auth/services/server/authorization";

export default async function UserProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await authGuard({
    allowRoles: ["admin", "user", "debugger"],
    redirectTo: "/login",
    statusRedirects: {
      inactive: "/reactivate",
      suspended: "/restricted",
      banned: "/restricted",
      security_locked: "/restricted",
      pending: "/logout?redirectTo=/signup",
      withdrawn: "/logout?redirectTo=/signup",
    },
  });

  return <>{children}</>;
}
