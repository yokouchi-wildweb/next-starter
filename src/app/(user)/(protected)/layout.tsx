// src/app/(user)/(protected)/layout.tsx

import type { ReactNode } from "react";

import { AuthSessionProvider } from "@/features/auth/components/AuthSessionProvider";
import { authGuard } from "@/features/auth/services/server/authorization";

export default async function UserProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await authGuard({ allowRoles: ["admin", "user"], redirectTo: "/login" });

  return <AuthSessionProvider>{children}</AuthSessionProvider>;
}
