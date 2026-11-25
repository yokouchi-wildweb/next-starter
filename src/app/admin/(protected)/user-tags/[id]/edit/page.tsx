// src/app/admin/(protected)/user-tags/[id]/edit/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける

export { AdminUserTagEditScreen as default, generateMetadata } from "./_screen/AdminUserTagEditScreen";
