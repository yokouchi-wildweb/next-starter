// src/app/admin/layout.tsx

import type { ReactNode } from "react";

import { AdminLayoutClient } from "@/components/Admin/Layout/AdminLayoutClient";
import { settingService } from "@/features/setting/services/server/settingService";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {

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
