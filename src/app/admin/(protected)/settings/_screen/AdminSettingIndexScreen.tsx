// src/app/admin/(protected)/settings/_screen/AdminSettingIndexScreen.tsx
// /admin/settings の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// loader が既定のセクションへ redirect するので、この画面は表示されない。管理のページは必ず AdminPage を返す
// (AdminPage を使わない管理のページを止める検査に例外を作らない)ので、題だけの AdminPage を返す。

import type { ScreenProps } from "@/lib/screens/types";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { loadAdminSettingIndexScreen } from "./loader";

export async function AdminSettingIndexScreen(props: ScreenProps) {
  await loadAdminSettingIndexScreen(props);
  return <AdminPage title="設定" />;
}
