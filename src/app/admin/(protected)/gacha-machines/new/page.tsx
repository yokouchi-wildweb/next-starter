export const dynamic = "force-dynamic";

import AdminGachaMachineCreate from "@/features/gachaMachine/components/AdminGachaMachineCreate";
import PageTitle from "../../../../../components/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";


export const metadata = {
  title: "ガチャマシン追加",
};

export default function AdminGachaMachineCreatePage() {

  return (

    <Main containerType="plain">
      <PageTitle>ガチャマシン追加</PageTitle>
      <AdminGachaMachineCreate redirectPath="/admin/gacha-machines" />
    </Main>

  );
}
