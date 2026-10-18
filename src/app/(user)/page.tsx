// src/app/(user)/page.tsx — トップページ(/)の 1 行スイッチ(下流所有)
// 上流の既定トップは ./_screen/StarterHomeScreen(デモ用)。ほぼ全ての下流は自前のトップページを
// ./_components/<Name>Screen.tsx に作り、下の 1 行の import 先だけを差し替える。手順: ./_screen/README.md

export { StarterHomeScreen as default } from "./_screen/StarterHomeScreen";
