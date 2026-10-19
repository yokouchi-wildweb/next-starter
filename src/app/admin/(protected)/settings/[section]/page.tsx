// src/app/admin/(protected)/settings/[section]/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける
export const dynamic = "force-dynamic";

export { AdminSettingSectionScreen as default, generateMetadata } from "./_screen/AdminSettingSectionScreen";
