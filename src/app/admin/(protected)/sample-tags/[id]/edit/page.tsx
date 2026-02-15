export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { sampleService } from "@/features/sample/services/server/sampleService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import AdminSampleTagEdit from "@/features/sampleTag/components/AdminSampleTagEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { SampleTag } from "@/features/sampleTag/entities";
import { resolveReturnTo } from "@/lib/crud/utils";

export const metadata = {
  title: "サンプルタグ編集",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function AdminSampleTagEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const redirectPath = resolveReturnTo(returnTo, "/admin/sample-tags");

  const [sampleTag, samples ] = await Promise.all([
    sampleTagService.get(id),
    sampleService.list()
  ]);


  return (
  <SWRConfig
    value={{
      fallback: { samples },
  }}
  >

    <AdminPage>
      <PageTitle>サンプルタグ編集</PageTitle>
      <AdminSampleTagEdit sampleTag={sampleTag as SampleTag} redirectPath={redirectPath} />
    </AdminPage>
  </SWRConfig>
  );
}
