// src/app/admin/settings/page.tsx
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import AdminSettingEdit from "@/features/core/setting/components/AdminSettingEdit";
import { settingService } from "@/features/core/setting/services/server/settingService";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "システム設定",
};

export default async function AdminSettingPage() {
  const setting = await settingService.getGlobalSetting();

  return (
    <AdminPage>
      <PageTitle>システム設定</PageTitle>
      <AdminSettingEdit setting={setting} redirectPath="/admin/settings" />
    </AdminPage>
  );
}
