// src/app/(user)/(protected)/wallet/[slug]/history/page.tsx — 画面の差し替えスイッチ
//
// 上流(next-starter)はこのファイルを今後編集しない。既定画面は _screen/ 側で変更する。
// 下流は自分の画面を _components/<Name>Screen.tsx に作り、下の 1 行の import 先だけを差し替える。
// metadata / dynamic 等のページ設定もこのファイルに書いてよい。手順: src/lib/screens/README.md

export { WalletHistoryScreen as default } from "./_screen/WalletHistoryScreen";
