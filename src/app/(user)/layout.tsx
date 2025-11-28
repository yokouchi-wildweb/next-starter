import type { ReactNode } from "react";

import { UserAppLayout } from "@/components/AppFrames/User/Layout";
import { settingService } from "@/features/core/setting/services/server/settingService";

export default async function UserLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const setting = await settingService.getGlobalSetting();

  return (
    <UserAppLayout footerText={setting.adminFooterText ?? undefined}>
      {children}
    </UserAppLayout>
  );
}
