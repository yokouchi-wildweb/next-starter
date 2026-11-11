// src/config/lib/siteTheme.config.ts
// サイトテーマ(ライト / ダーク)の設定の上書き(@lib-config/siteTheme)。値はリテラルで書く。キーと既定: src/lib/siteTheme/README.md
// 何も書かなければ: 全エリアがライト既定、管理画面(/admin, /debug)のみ切替可、ユーザー側は固定。
//
// 例: ユーザー側をダーク固定にする            { fallback: { mode: "dark" } }
// 例: ユーザー側を OS 設定に追従・切替可にする  { fallback: { mode: "system", switchable: true } }
// 例: 管理画面の切替スイッチを消してライト固定  { areas: [{ key: "admin", switchable: false }] }
// 例: エリアを追加する(key で合わせ、知らない key は末尾に追加) { areas: [{ key: "kiosk", match: ["/kiosk"], mode: "dark" }] }
import type { SiteThemeOverride } from "@/lib/siteTheme";

export default {} satisfies SiteThemeOverride;
