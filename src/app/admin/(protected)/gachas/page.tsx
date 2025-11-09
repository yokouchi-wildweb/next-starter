

"use client"

import Link from "next/link";

export const dynamic = "force-dynamic";


import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import { Button } from "@/components/Form/Button";


type DummyGacha = {
  id: number;
  name: string;
  price: number;
  active: boolean;
};

const dummyData: DummyGacha[] = [
  { id: 1, name: "スタンダードガチャ", price: 100, active: true },
  { id: 2, name: "プレミアムガチャ", price: 300, active: false },
  { id: 3, name: "スペシャルガチャ", price: 500, active: true },
];

const columns: DataTableColumn<DummyGacha>[] = [
  { header: "ID", render: (g) => g.id },
  { header: "ガチャ名", render: (g) => g.name },
  { header: "価格(ポイント)", render: (g) => g.price.toLocaleString() },
  { header: "状態", render: (g) => (g.active ? "有効" : "無効") },
];

export default function AdminGachaListPage() {

  return (
    <AdminPage>



      <AdminPageTitle>ガチャの設定</AdminPageTitle>

      <DataTable items={dummyData} columns={columns} />

      <Button asChild>
        <Link href={`/gacha/start/`}>ガチャをプレビュー</Link>
      </Button>

    </AdminPage>
  );
}
