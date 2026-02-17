// src/app/(user)/(protected)/layout.tsx

import type { ReactNode } from "react";

import { authGuard } from "@/features/core/auth/services/server/authorization";
import { getRolesByCategory } from "@/features/core/user/constants";

export default async function UserProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await authGuard({
    allowRoles: [...getRolesByCategory("admin"), ...getRolesByCategory("user")],
    redirectTo: "/login",
    returnBack: true,
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
