// src/app/admin/(protected)/settings/_screen/AdminSettingIndexScreen.tsx
// /admin/settings の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// 表示は無い。loader が既定のセクションへ redirect する。

import { loadAdminSettingIndexScreen } from "./loader";

export async function AdminSettingIndexScreen() {
  await loadAdminSettingIndexScreen();
  return null;
}
