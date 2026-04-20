// src/app/admin/(protected)/settings/[section]/page.tsx
//
// システム設定の動的ルート。
// `setting.sections.ts` のセクションキーと URL を対応させる。
// セクションに `allowRoles` がある場合はアクセス時にロールを検証する。

import { notFound } from "next/navigation";

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { authGuard } from "@/features/core/auth/services/server/authorization";
import AdminSettingSectionEdit from "@/features/core/setting/components/AdminSettingSectionEdit";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { settingSections } from "@/features/core/setting/setting.sections";

export const dynamic = "force-dynamic";

type Params = { section: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { section } = await params;
  const sec = settingSections[section];
  return { title: sec?.label ?? "システム設定" };
}

export default async function AdminSettingSectionPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { section: sectionKey } = await params;
  const section = settingSections[sectionKey];
  if (!section) notFound();

  // セクション固有の権限要求がある場合は個別に guard
  if (section.allowRoles && section.allowRoles.length > 0) {
    await authGuard({ allowRoles: section.allowRoles, redirectTo: "/admin" });
  }

  const setting = await settingService.getGlobalSetting();
  const redirectPath = `/admin/settings/${sectionKey}`;

  return (
    <AdminPage>
      <PageTitle>{section.label}</PageTitle>
      <AdminSettingSectionEdit
        section={section}
        setting={setting}
        redirectPath={redirectPath}
      />
    </AdminPage>
  );
}
