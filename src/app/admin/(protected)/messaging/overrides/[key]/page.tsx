// src/app/admin/(protected)/messaging/overrides/[key]/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける
export const dynamic = "force-dynamic";

export { AdminMessagingOverrideScreen as default, metadata } from "./_screen/AdminMessagingOverrideScreen";
