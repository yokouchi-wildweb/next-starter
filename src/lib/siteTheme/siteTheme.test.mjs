// サイトテーマ判定の契約テスト。
// 実行: pnpm test:site-theme (node:test + tsx。.ts の拡張子無し import を解決するため tsx ランナーを使う)
//
// 検証すること:
// 1. defineSiteThemeConfig の既定値が従来挙動(全エリアライト、管理のみ切替可)を再現する
// 2. エリア一致はセグメント境界(/admin は /administer に一致しない)
// 3. switchable=false のエリアは保存値を無視する(管理→ユーザーの漏れ防止)
// 4. bootstrap script(手書き JS)と resolve.ts が同一ケース集で同じ結果を返す
import { test } from "node:test";
import assert from "node:assert/strict";

import { defineSiteThemeConfig, normalizeAreaPrefix } from "./defineConfig.ts";
import { resolveSiteTheme, matchesAreaPrefix, getSiteThemeAreaByKey } from "./resolve.ts";
import { buildSiteThemeBootstrapScript } from "./bootstrapScript.ts";

/**
 * bootstrap script を疑似 DOM で実行し、最終的な html の状態を返す。
 * options.noMatchMedia: window.matchMedia 未定義の環境を再現
 * options.storageThrows: localStorage.getItem が throw する環境を再現
 */
function runBootstrap(config, { pathname, stored, systemPrefersDark }, options = {}) {
  const classes = new Set();
  const attrs = new Map();
  const localStorage = {
    getItem: (key) => {
      if (options.storageThrows) throw new Error("denied");
      return key === config.storageKey ? stored : null;
    },
  };
  const window = options.noMatchMedia
    ? {}
    : {
        matchMedia: (query) => ({
          matches: query === "(prefers-color-scheme: dark)" ? systemPrefersDark : false,
        }),
      };
  const document = {
    documentElement: {
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
      },
      setAttribute: (k, v) => attrs.set(k, v),
    },
  };
  const script = buildSiteThemeBootstrapScript(config);
  // スクリプトが参照する自由変数を引数でシャドーイングして実行する
  new Function("location", "localStorage", "window", "document", script)(
    { pathname },
    localStorage,
    window,
    document,
  );
  return { isDark: classes.has("dark"), area: attrs.get("data-area") };
}

const DEFAULT = defineSiteThemeConfig({});

const DARK_FIRST = defineSiteThemeConfig({
  fallback: { mode: "dark" },
});

const SYSTEM_USER = defineSiteThemeConfig({
  fallback: { mode: "system", switchable: true },
  areas: [{ key: "admin", switchable: false, mode: "dark" }],
});

const WITH_EXTRA_AREA = defineSiteThemeConfig({
  areas: [{ key: "kiosk", match: ["/kiosk/"], mode: "dark" }],
});

const CATCH_ALL = defineSiteThemeConfig({
  areas: [{ key: "all", match: ["/"], mode: "dark" }],
});

const GHOST_AREA = defineSiteThemeConfig({
  areas: [{ key: "ghost", mode: "dark" }], // match 未指定 = どこにも一致しない
});

const CUSTOM_KEY = defineSiteThemeConfig({ storageKey: "theme-v2" });

/** [config, input, expected] */
const CASES = [
  // 既定値: 従来挙動
  [DEFAULT, { pathname: "/", stored: null, systemPrefersDark: true }, { isDark: false, area: "user" }],
  [DEFAULT, { pathname: "/mypage", stored: "dark", systemPrefersDark: false }, { isDark: false, area: "user" }], // ユーザー側は保存値を無視
  [DEFAULT, { pathname: "/admin", stored: null, systemPrefersDark: true }, { isDark: false, area: "admin" }],
  [DEFAULT, { pathname: "/admin/", stored: "dark", systemPrefersDark: false }, { isDark: true, area: "admin" }], // 末尾スラッシュ付きパス
  [DEFAULT, { pathname: "/admin/users", stored: "dark", systemPrefersDark: false }, { isDark: true, area: "admin" }],
  [DEFAULT, { pathname: "/admin/users", stored: "light", systemPrefersDark: true }, { isDark: false, area: "admin" }],
  [DEFAULT, { pathname: "/debug/ping", stored: "dark", systemPrefersDark: false }, { isDark: true, area: "admin" }],
  [DEFAULT, { pathname: "/administer", stored: "dark", systemPrefersDark: false }, { isDark: false, area: "user" }], // セグメント境界
  [DEFAULT, { pathname: "/admin", stored: "garbage", systemPrefersDark: false }, { isDark: false, area: "admin" }], // 不正値は未保存扱い
  // ダーク既定(88-base 相当)
  [DARK_FIRST, { pathname: "/", stored: "light", systemPrefersDark: false }, { isDark: true, area: "user" }],
  [DARK_FIRST, { pathname: "/admin", stored: null, systemPrefersDark: false }, { isDark: false, area: "admin" }],
  // system 追従 + 管理側ダーク固定
  [SYSTEM_USER, { pathname: "/", stored: null, systemPrefersDark: true }, { isDark: true, area: "user" }],
  [SYSTEM_USER, { pathname: "/", stored: null, systemPrefersDark: false }, { isDark: false, area: "user" }],
  [SYSTEM_USER, { pathname: "/", stored: "light", systemPrefersDark: true }, { isDark: false, area: "user" }], // 切替可なら保存値優先
  [SYSTEM_USER, { pathname: "/admin", stored: "light", systemPrefersDark: false }, { isDark: true, area: "admin" }], // 固定なら保存値無視
  // エリア追加(末尾の / は正規化される)
  [WITH_EXTRA_AREA, { pathname: "/kiosk", stored: null, systemPrefersDark: false }, { isDark: true, area: "kiosk" }],
  [WITH_EXTRA_AREA, { pathname: "/kiosk/1", stored: null, systemPrefersDark: false }, { isDark: true, area: "kiosk" }],
  [WITH_EXTRA_AREA, { pathname: "/admin", stored: null, systemPrefersDark: false }, { isDark: false, area: "admin" }],
  // catch-all "/"(admin より後ろなので admin が先に勝つ)
  [CATCH_ALL, { pathname: "/anything/deep", stored: null, systemPrefersDark: false }, { isDark: true, area: "all" }],
  [CATCH_ALL, { pathname: "/", stored: null, systemPrefersDark: false }, { isDark: true, area: "all" }],
  [CATCH_ALL, { pathname: "/admin", stored: null, systemPrefersDark: false }, { isDark: false, area: "admin" }],
  // match 無しのエリアはどこにも一致しない
  [GHOST_AREA, { pathname: "/ghost", stored: null, systemPrefersDark: false }, { isDark: false, area: "user" }],
  // storageKey 変更: 旧キー "theme" の値は読まれない(fake は config.storageKey 一致時だけ返す)
  [CUSTOM_KEY, { pathname: "/admin", stored: "dark", systemPrefersDark: false }, { isDark: true, area: "admin" }],
];

test("既定値は従来挙動を再現する(全エリアライト、管理のみ切替可、ユーザー側は固定)", () => {
  assert.equal(DEFAULT.storageKey, "theme");
  assert.deepEqual(DEFAULT.fallback, { key: "user", mode: "light", switchable: false });
  assert.deepEqual(DEFAULT.areas, [
    { key: "admin", match: ["/admin", "/debug"], mode: "light", switchable: true },
  ]);
});

test("defineSiteThemeConfig は key 一致で部分更新し、未知の key は末尾に追加する", () => {
  assert.deepEqual(SYSTEM_USER.areas, [
    { key: "admin", match: ["/admin", "/debug"], mode: "dark", switchable: false },
  ]);
  assert.deepEqual(WITH_EXTRA_AREA.areas.map((a) => a.key), ["admin", "kiosk"]);
  assert.deepEqual(WITH_EXTRA_AREA.areas[1].match, ["/kiosk"]);
  assert.deepEqual(GHOST_AREA.areas[1], { key: "ghost", match: [], mode: "dark", switchable: false });
  // 同じ key を複数回 patch → 後勝ち、位置維持
  const twice = defineSiteThemeConfig({
    areas: [
      { key: "admin", mode: "dark" },
      { key: "kiosk", match: ["/k"] },
      { key: "admin", switchable: false },
    ],
  });
  assert.deepEqual(twice.areas.map((a) => a.key), ["admin", "kiosk"]);
  assert.deepEqual(twice.areas[0], { key: "admin", match: ["/admin", "/debug"], mode: "dark", switchable: false });
});

test("defineSiteThemeConfig は不正な mode を fallback / areas の両方で拒否する", () => {
  assert.throws(() => defineSiteThemeConfig({ fallback: { mode: "sepia" } }), /light \| dark \| system/);
  assert.throws(() => defineSiteThemeConfig({ areas: [{ key: "admin", mode: "sepia" }] }), /light \| dark \| system/);
});

test("normalizeAreaPrefix: 先頭 / 付与、末尾 / 除去、空文字は拒否(catch-all への暗黙変換を防ぐ)", () => {
  assert.equal(normalizeAreaPrefix("admin"), "/admin");
  assert.equal(normalizeAreaPrefix("/admin/"), "/admin");
  assert.equal(normalizeAreaPrefix("/admin//"), "/admin");
  assert.equal(normalizeAreaPrefix("/"), "/");
  assert.throws(() => normalizeAreaPrefix(""), /空文字/);
  assert.throws(() => defineSiteThemeConfig({ areas: [{ key: "x", match: [""] }] }), /空文字/);
});

test("matchesAreaPrefix はセグメント境界で判定し、/ は全パスに一致する", () => {
  assert.equal(matchesAreaPrefix("/admin", "/admin"), true);
  assert.equal(matchesAreaPrefix("/admin/users", "/admin"), true);
  assert.equal(matchesAreaPrefix("/administer", "/admin"), false);
  assert.equal(matchesAreaPrefix("/anything", "/"), true);
});

test("getSiteThemeAreaByKey は key で引き、未知の key は fallback を返す", () => {
  assert.deepEqual(getSiteThemeAreaByKey(DEFAULT, "admin"), { key: "admin", mode: "light", switchable: true });
  assert.deepEqual(getSiteThemeAreaByKey(DEFAULT, "user"), { key: "user", mode: "light", switchable: false });
  assert.deepEqual(getSiteThemeAreaByKey(DEFAULT, null), { key: "user", mode: "light", switchable: false });
  assert.deepEqual(getSiteThemeAreaByKey(DEFAULT, "nope"), { key: "user", mode: "light", switchable: false });
});

test("resolveSiteTheme: ケース集", () => {
  for (const [config, input, expected] of CASES) {
    const result = resolveSiteTheme(config, input);
    assert.deepEqual(
      { isDark: result.isDark, area: result.area.key },
      expected,
      `resolve ${JSON.stringify(input)}`,
    );
  }
});

test("bootstrap script は resolveSiteTheme と同じ結果を返す(ロジック二重化の一致検証)", () => {
  for (const [config, input, expected] of CASES) {
    assert.deepEqual(runBootstrap(config, input), expected, `bootstrap ${JSON.stringify(input)}`);
  }
});

test("bootstrap script: system モードで matchMedia が無ければ light、localStorage が throw しても OS 設定にフォールバックする", () => {
  const input = { pathname: "/", stored: "dark", systemPrefersDark: true };
  // matchMedia 無し → system は false 扱い(resolve 側は systemPrefersDark=false を渡した場合と同じ)
  assert.deepEqual(runBootstrap(SYSTEM_USER, { ...input, stored: null }, { noMatchMedia: true }), { isDark: false, area: "user" });
  assert.deepEqual(resolveSiteTheme(SYSTEM_USER, { ...input, stored: null, systemPrefersDark: false }).isDark, false);
  // switchable + 保存値あり だが localStorage が throw → 保存値は読めず OS 設定(dark)に従う
  assert.deepEqual(runBootstrap(SYSTEM_USER, input, { storageThrows: true }), { isDark: true, area: "user" });
  assert.deepEqual(resolveSiteTheme(SYSTEM_USER, { ...input, stored: null }).isDark, true);
});

test("bootstrap script は </script> を含まない(インライン埋め込みの安全性)", () => {
  const config = defineSiteThemeConfig({ areas: [{ key: "x</script><script>alert(1)</script>", match: ["/x"] }] });
  const script = buildSiteThemeBootstrapScript(config);
  assert.equal(script.includes("</script>"), false);
});

test("bootstrap script は localStorage が throw しても判定を続行して DOM を更新する", () => {
  const script = buildSiteThemeBootstrapScript(DEFAULT);
  const calls = [];
  const document = {
    documentElement: {
      classList: { add: () => calls.push("add"), remove: () => calls.push("remove") },
      setAttribute: () => calls.push("attr"),
    },
  };
  const localStorage = { getItem: () => { throw new Error("denied"); } };
  assert.doesNotThrow(() =>
    new Function("location", "localStorage", "window", "document", script)(
      { pathname: "/admin" },
      localStorage,
      {},
      document,
    ),
  );
  assert.deepEqual(calls, ["remove", "attr"]);
});
