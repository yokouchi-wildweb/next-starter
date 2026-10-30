// src/app/(user)/demo/seamless-av/play/page.tsx — 画面の切り替え(1 行スイッチ)。本体は _screen/DemoSeamlessAvPlayScreen.tsx
// 常に最新の保存内容を読むためキャッシュしない
export const dynamic = "force-dynamic";

export { DemoSeamlessAvPlayScreen as default, metadata } from "./_screen/DemoSeamlessAvPlayScreen";
