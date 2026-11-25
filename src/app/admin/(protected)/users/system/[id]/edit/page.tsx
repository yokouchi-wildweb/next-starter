// src/app/admin/(protected)/users/system/[id]/edit/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける

export { AdminSystemUserEditScreen as default, generateMetadata } from "./_screen/AdminSystemUserEditScreen";
