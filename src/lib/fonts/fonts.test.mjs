// 書体設定の契約テスト。
// 実行: pnpm test:fonts (node:test + tsx)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineFontsConfig, FONT_SANS_LOADED_VAR, FONT_MONO_LOADED_VAR } from "./defineConfig.ts";

const here = dirname(fileURLToPath(import.meta.url));
const typographyCss = readFileSync(resolve(here, "../../styles/typography.defaults.css"), "utf8");

test("既定は Web フォント無し(className 空、sans/mono null)", () => {
  assert.deepEqual(defineFontsConfig({}), { sans: null, mono: null, className: "" });
  assert.deepEqual(defineFontsConfig(), { sans: null, mono: null, className: "" });
});

test("渡したフォントの variable クラスだけを連結する", () => {
  const sans = { variable: "__variable_sans", className: "__cls_sans" };
  const mono = { variable: "__variable_mono", className: "__cls_mono" };
  assert.equal(defineFontsConfig({ sans }).className, "__variable_sans");
  assert.equal(defineFontsConfig({ sans, mono }).className, "__variable_sans __variable_mono");
  assert.equal(defineFontsConfig({ mono, sans: null }).className, "__variable_mono");
});

test("variable 無しのローダー結果は拒否する(className だけ渡しても参照経路に乗らない)", () => {
  assert.throws(() => defineFontsConfig({ sans: { className: "__cls" } }), /variable オプション/);
  assert.throws(() => defineFontsConfig({ mono: { variable: "", className: "__cls" } }), /variable オプション/);
});

test("typography.defaults.css のスタックは loaded 変数をフォールバック付きで参照する", () => {
  assert.match(typographyCss, new RegExp(`--font-geist-sans:\\s*var\\(${FONT_SANS_LOADED_VAR},`));
  assert.match(typographyCss, new RegExp(`--font-geist-mono:\\s*var\\(${FONT_MONO_LOADED_VAR},`));
});
