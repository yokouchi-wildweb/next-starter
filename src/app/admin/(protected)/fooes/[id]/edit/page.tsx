export const dynamic = "force-dynamic";


import { fooService } from "@/features/foo/services/server/fooService";
import AdminFooEdit from "@/features/foo/components/AdminFooEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { Foo } from "@/features/foo/entities";

export const metadata = {
  title: "foo編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminFooEditPage({ params }: Props) {
  const { id } = await params;
  const foo = (await fooService.get(id)) as Foo;


  return (

    <AdminPage>
      <PageTitle>foo編集</PageTitle>
      <AdminFooEdit foo={foo as Foo} redirectPath="/admin/fooes" />
    </AdminPage>

  );
}
