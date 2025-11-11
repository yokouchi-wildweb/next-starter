// src/app/admin/settings/page.tsx
import { Main, PageTitle } from "@/components/TextBlocks";
import AdminSettingEdit from "@/features/setting/components/AdminSettingEdit";
import { settingService } from "@/features/setting/services/server/settingService";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "システム設定",
};

export default async function AdminSettingPage() {
  const setting = await settingService.getGlobalSetting();

  return (
    <Main>
      <PageTitle variant="accent">システム設定</PageTitle>
      <AdminSettingEdit setting={setting} redirectPath="/admin/settings" />
    </Main>
  );
}
