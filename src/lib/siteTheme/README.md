# siteTheme

サイトテーマ(ライト / ダーク)をパスのエリアごとに決める閉じた lib。判定の純関数・<head> の bootstrap script・クライアントの store と同期(SiteThemeSync)・設定を持つ。読む lib = `appEnv`(開発時の警告)・`defineConfig`(設定の合成)。棚の部品は読まない(切替ボタン `DarkModeSwitch` は棚 `src/components/Fanctional` にあり、この lib の入口を読む)。仕組みの全体: [src/styles/README.md](../../styles/README.md)「サイトテーマ」。

## 入口(`@/lib/siteTheme`)

- `siteThemeConfig` — 合成済みの設定(既定 + 上書き)。root layout・DarkModeSwitch が読む
- `SiteThemeSync` — root layout に 1 つだけ置く常駐部品(描画なし)。クライアント遷移・切替・OS 設定の変化で再解決し、`<html>` の `dark` クラスと `data-area` を書く唯一の書き手
- `useSiteThemeStore()` — `{ isDark, areaKey, switchable, toggle, setDark }`。保存(localStorage)は `setDark` / `toggle` のときだけ。switchable でないエリアでは何もしない
- 判定の純関数: `resolveSiteTheme`・`resolveSiteThemeArea`・`resolveIsDark`・`getSiteThemeAreaByKey`・`matchesAreaPrefix`・`normalizeStoredPreference`・`normalizeAreaPrefix`
- `buildSiteThemeBootstrapScript(config)`・`SITE_THEME_AREA_ATTRIBUTE`(`data-area`)・`SITE_THEME_DEFAULTS`・`SITE_THEME_STORAGE_KEY`
- 型: `SiteThemeOverride`(上書きのファイルの型)・`SiteThemeConfig`・`SiteThemeArea`・`SiteThemeFallback`・`SiteThemeMode`・`ResolvedSiteTheme`・`ResolvedSiteThemeArea`・`SiteThemeResolveInput`・`StoredThemePreference`

DOM と保存の関数(`dom.ts`)と `useSiteThemeSync` は lib の中だけで使う(入口から出さない)。`<html>` を外から触らない。

## 設定(`src/config/lib/siteTheme.config.ts` = `@lib-config/siteTheme`)

```ts
import type { SiteThemeOverride } from "@/lib/siteTheme";

export default {
  fallback: { mode: "dark" },                                   // どのエリアにも一致しないパス(ユーザー側)
  areas: [{ key: "kiosk", match: ["/kiosk"], mode: "dark" }],   // key で合わせる
} satisfies SiteThemeOverride;
```

- キー: `storageKey`(既定 `"theme"`)・`areas`(既定 `admin` = `/admin`・`/debug`、ライト、切替可)・`fallback`(既定 `user`、ライト、切替不可)
- 合成は `@/lib/defineConfig`: `areas` は `key` で合わせる(同じ key = 部分更新で位置は既定のまま、知らない key = 末尾に追加、`{ key, $delete: true }` = 消す)。`fallback` は部分更新
- 追加したエリアの書かなかった欄は `match: []`・`mode: "light"`・`switchable: false`。`match` の接頭辞は正規化する(先頭 `/` を付け末尾 `/` を落とす。空文字は誤り、全パスは `"/"`)。`mode` が light | dark | system でなければ誤り
- 値はリテラルで書く(上書きのファイルに関数を置かない)

## テスト

`pnpm test src/lib/siteTheme`: `siteTheme.test.mjs`(判定と bootstrap script の一致)・`config.test.ts`(上書きが効く・既定の bootstrap script が合成を移す前と同じ文字列)

## package.json

`sideEffects` は書かない(読み込み時に zustand の store を作る)。
