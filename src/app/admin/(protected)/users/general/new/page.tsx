// src/app/admin/(protected)/users/general/new/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける
export const dynamic = "force-dynamic";

export { AdminGeneralUserCreateScreen as default, metadata } from "./_screen/AdminGeneralUserCreateScreen";
