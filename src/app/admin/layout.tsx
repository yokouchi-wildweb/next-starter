// src/app/admin/layout.tsx

import type { ReactNode } from "react";

import { AdminOuterLayout } from "@/components/AppFrames/Admin/Layout/AdminOuterLayout";
import { settingService } from "@/features/core/setting/services/server/settingService";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {

  const setting = await settingService.getGlobalSetting();

  return (
    <AdminOuterLayout
      headerLogoUrl={setting.adminHeaderLogoImageUrl ?? undefined}
      headerLogoDarkUrl={setting.adminHeaderLogoImageDarkUrl ?? undefined}
    >
      {children}
    </AdminOuterLayout>
  );
}
