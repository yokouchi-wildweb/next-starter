// src/app/admin/settings/page.tsx
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import AdminSettingEdit from "@/features/setting/components/AdminSettingEdit";
import { settingService } from "@/features/setting/services/server/settingService";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "システム設定",
};

export default async function AdminSettingPage() {
  const setting = await settingService.getGlobalSetting();

  return (
    <AdminPage>
      <AdminPageTitle>システム設定</AdminPageTitle>
      <AdminSettingEdit setting={setting} redirectPath="/admin/settings" />
    </AdminPage>
  );
}
