// src/app/(user)/maintenance/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける

export { MaintenanceScreen as default, generateMetadata } from "./_screen/MaintenanceScreen";
