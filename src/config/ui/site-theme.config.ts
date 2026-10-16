/**
 * サイトテーマ(ライト / ダーク)の既定とエリア別ロック
 *
 * ★ このファイルは下流所有です。upstream は初回作成後に編集しません。
 *   書いた項目だけが上流既定値(src/lib/siteTheme/defaults.ts)を上書きします。
 *   何も書かなければ従来どおり: 全エリアがライト既定、管理画面(/admin, /debug)のみ切替可、
 *   ユーザー側は固定(管理画面でダークを選んでもユーザー側に漏れない)。
 *
 * 例: ユーザー側をダーク固定にする
 *   defineSiteThemeConfig({ fallback: { mode: "dark" } })
 *
 * 例: ユーザー側を OS 設定に追従させ、利用者が切り替えられるようにする
 *   defineSiteThemeConfig({ fallback: { mode: "system", switchable: true } })
 *
 * 例: 管理画面の切替スイッチを消してライト固定にする
 *   defineSiteThemeConfig({ areas: [{ key: "admin", switchable: false }] })
 *
 * 例: エリアを追加する(先頭一致順、既存 key は部分更新、新規 key は末尾に追加)
 *   defineSiteThemeConfig({ areas: [{ key: "kiosk", match: ["/kiosk"], mode: "dark" }] })
 *
 * エリア key は <html data-area="..."> に出力され、CSS で `[data-area="user"] { --primary: ... }`
 * のようにエリア別の色を当てられる(src/styles/custom/palette.css)。
 * 詳細: src/styles/README.md
 */

import { defineSiteThemeConfig } from "@/lib/siteTheme";

export const SITE_THEME_CONFIG = defineSiteThemeConfig({});
