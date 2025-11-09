// src/app/admin/titles/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { titleService } from "@/features/title/services/server/titleService";
import AdminTitleEdit from "@/features/title/components/AdminTitleEdit";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import type { Title } from "@/features/title/entities";

export const metadata = {
  title: "タイトル編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminTitleEditPage({ params }: Props) {
  const { id } = await params;
  const title = (await titleService.get(id)) as Title;

  return (
    <AdminPage>
      <AdminPageTitle>タイトル編集</AdminPageTitle>
      <AdminTitleEdit title={title} redirectPath="/admin/titles" />
    </AdminPage>
  );
}
