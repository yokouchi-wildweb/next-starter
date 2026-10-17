// src/app/admin/(protected)/samples/page.tsx — 画面の差し替えスイッチ
//
// dc:generate はこのファイルを初回だけ生成し、以後は上書きしない(write-once)。
// 既定画面は _screen/ 側で、dc:generate のたびに再生成される(手で編集しない)。
// 画面を差し替えるときは _components/<Name>Screen.tsx を作り、下の import 先を向ける。
// 手順: src/lib/screens/README.md
export const dynamic = "force-dynamic";

export { AdminSampleListScreen as default, metadata } from "./_screen/AdminSampleListScreen";
