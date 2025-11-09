export const dynamic = "force-dynamic";

import { cardTagService } from "@/features/cardTag/services/server/cardTagService";
import AdminCardTagEdit from "@/features/cardTag/components/AdminCardTagEdit";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import type { CardTag } from "@/features/cardTag/entities";

export const metadata = {
  title: "カードタグ編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCardTagEditPage({ params }: Props) {
  const { id } = await params;
  const cardTag = (await cardTagService.get(id)) as CardTag;

  return (
    <AdminPage>
      <AdminPageTitle>カードタグ編集</AdminPageTitle>
      <AdminCardTagEdit cardTag={cardTag} redirectPath="/admin/card-tags" />
    </AdminPage>
  );
}
