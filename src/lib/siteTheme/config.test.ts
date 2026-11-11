// src/lib/siteTheme/config.test.ts
// サイトテーマの設定の上書き(@lib-config/siteTheme)が判定と bootstrap script に効くことのテスト。
// 実行: pnpm test src/lib/siteTheme (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSiteThemeBootstrapScript } from "./bootstrapScript";
import { composeSiteThemeConfig, siteThemeConfigDef } from "./compose";
import { siteThemeConfig } from "./config";
import { SITE_THEME_DEFAULTS } from "./defaults";
import { resolveSiteTheme } from "./resolve";

// 合成を defineConfig へ移す前(defineSiteThemeConfig({}))の既定の出力。既定の設定では 1 字も変えない
const DEFAULT_BOOTSTRAP_SCRIPT = "(function(){try{var c={\"storageKey\":\"theme\",\"areas\":[{\"key\":\"admin\",\"match\":[\"/admin\",\"/debug\"],\"mode\":\"light\",\"switchable\":true}],\"fallback\":{\"key\":\"user\",\"mode\":\"light\",\"switchable\":false}};var p=location.pathname;var a=null;for(var i=0;i<c.areas.length&&!a;i++){var ar=c.areas[i];for(var j=0;j<ar.match.length;j++){var m=ar.match[j];if(m===\"/\"||p===m||p.indexOf(m+\"/\")===0){a=ar;break}}}if(!a){a=c.fallback}var s=null;if(a.switchable){try{s=localStorage.getItem(c.storageKey)}catch(e){}}var d;if(s===\"dark\"||s===\"light\"){d=s===\"dark\"}else if(a.mode===\"system\"){d=!!(window.matchMedia&&window.matchMedia(\"(prefers-color-scheme: dark)\").matches)}else{d=a.mode===\"dark\"}var r=document.documentElement;if(d){r.classList.add(\"dark\")}else{r.classList.remove(\"dark\")}r.setAttribute(\"data-area\",a.key)}catch(e){}})();";

test("上流の空の上書きでは既定のまま、読み込んだ設定(@lib-config/siteTheme)も同じキー", () => {
  assert.deepEqual(Object.keys(siteThemeConfig).sort(), Object.keys(SITE_THEME_DEFAULTS).sort());
  assert.deepEqual(composeSiteThemeConfig({}), SITE_THEME_DEFAULTS);
  assert.deepEqual(siteThemeConfigDef.compose({}), SITE_THEME_DEFAULTS);
});

test("既定の設定の bootstrap script は合成を移す前と同じ文字列", () => {
  assert.equal(buildSiteThemeBootstrapScript(composeSiteThemeConfig({})), DEFAULT_BOOTSTRAP_SCRIPT);
});

test("fallback の上書きがユーザー側の判定と bootstrap script に効く", () => {
  const config = composeSiteThemeConfig({ fallback: { mode: "dark" } });
  assert.deepEqual(config.fallback, { key: "user", mode: "dark", switchable: false });
  assert.equal(resolveSiteTheme(config, { pathname: "/", stored: null, systemPrefersDark: false }).isDark, true);
  assert.ok(buildSiteThemeBootstrapScript(config).includes('"fallback":{"key":"user","mode":"dark","switchable":false}'));
});

test("areas は key で合わせる: 既定の項目は部分更新(位置と match は既定のまま)、知らない key は末尾に欄を埋めて足す", () => {
  const config = composeSiteThemeConfig({
    areas: [
      { key: "admin", switchable: false },
      { key: "draft", match: ["draft/a/"] },
    ],
  });
  assert.deepEqual(config.areas, [
    { key: "admin", match: ["/admin", "/debug"], mode: "light", switchable: false },
    { key: "draft", match: ["/draft/a"], mode: "light", switchable: false },
  ]);
  assert.equal(resolveSiteTheme(config, { pathname: "/draft/a/1", stored: null, systemPrefersDark: false }).area.key, "draft");
});

test("{ key, $delete: true } で既定のエリアを消せる(defineConfig の配列の規則)", () => {
  const config = composeSiteThemeConfig({ areas: [{ key: "admin", $delete: true }] });
  assert.deepEqual(config.areas, []);
  assert.equal(resolveSiteTheme(config, { pathname: "/admin", stored: "dark", systemPrefersDark: false }).area.key, "user");
});

test("storageKey の上書きが bootstrap script の読むキーに効く", () => {
  const config = composeSiteThemeConfig({ storageKey: "theme-v2" });
  assert.equal(config.storageKey, "theme-v2");
  assert.ok(buildSiteThemeBootstrapScript(config).includes('"storageKey":"theme-v2"'));
});

test("不正な mode は合成で止める", () => {
  // 型を外して実行時の検査を見る
  const bad = { fallback: { mode: "sepia" } } as unknown as Parameters<typeof composeSiteThemeConfig>[0];
  assert.throws(() => composeSiteThemeConfig(bad), /light \| dark \| system/);
});
