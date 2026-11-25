// src/app/admin/(protected)/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける

export { AdminHomeScreen as default, generateMetadata } from "./_screen/AdminHomeScreen";
