// src/app/admin/(protected)/layout.tsx

import type { ReactNode } from "react";

import { AdminLayoutClient } from "@/components/Admin/Layout/AdminLayoutClient";
import { authGuard } from "@/features/auth/services/server/authorization";
import { settingService } from "@/features/setting/services/server/settingService";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await authGuard({ allowRoles: ["admin"], redirectTo: "/admin/login" });
  const setting = await settingService.getGlobalSetting();

  return (
    <AdminLayoutClient
      headerLogoUrl={setting.adminHeaderLogoImageUrl ?? undefined}
      headerLogoDarkUrl={setting.adminHeaderLogoImageDarkUrl ?? undefined}
      footerText={setting.adminFooterText ?? undefined}
    >
      {children}
    </AdminLayoutClient>
  );
}
