export const dynamic = "force-dynamic";

import { gachaMachineService } from "@/features/gachaMachine/services/server/gachaMachineService";
import AdminGachaMachineEdit from "@/features/gachaMachine/components/AdminGachaMachineEdit";
import PageTitle from "../../../../../../components/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import type { GachaMachine } from "@/features/gachaMachine/entities";


export const metadata = {
  title: "ガチャマシン編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminGachaMachineEditPage({ params }: Props) {
  const { id } = await params;
  const gachaMachine = (await gachaMachineService.get(id)) as GachaMachine;


  return (

    <Main containerType="plain">
      <PageTitle>ガチャマシン編集</PageTitle>
      <AdminGachaMachineEdit gachaMachine={gachaMachine as GachaMachine} redirectPath="/admin/gacha-machines" />
    </Main>

  );
}
