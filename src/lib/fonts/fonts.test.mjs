// 書体設定の契約テスト。
// 実行: pnpm test:fonts (node:test + tsx)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineFontsConfig, FONT_SANS_LOADED_VAR, FONT_MONO_LOADED_VAR } from "./defineConfig.ts";

const here = dirname(fileURLToPath(import.meta.url));
const typographyCss = readFileSync(resolve(here, "../../styles/_base/typography.defaults.css"), "utf8");
const fontsConfigSource = readFileSync(resolve(here, "../../config/ui/fonts.config.ts"), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** 従来からの system スタック(見た目を変えない契約)。変更時はこのテストと .notices を更新する */
const DEFAULT_SANS_STACK = '"Inter", "system-ui", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const DEFAULT_MONO_STACK = '"ui-monospace", "SFMono-Regular", "Menlo", "Consolas", monospace';

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

test("typography.defaults.css のスタックは loaded 変数をフォールバック付きで参照し、既定スタックは従来どおり", () => {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    typographyCss,
    new RegExp(`--font-geist-sans:\\s*var\\(${FONT_SANS_LOADED_VAR},\\s*${escape(DEFAULT_SANS_STACK)}\\);`),
  );
  assert.match(
    typographyCss,
    new RegExp(`--font-geist-mono:\\s*var\\(${FONT_MONO_LOADED_VAR},\\s*${escape(DEFAULT_MONO_STACK)}\\);`),
  );
});

test("fonts.config.ts の next/font ローダーに書かれた variable 名は固定名のみ(誤記は黙って無視されるため静的に検査)", () => {
  // next/font の .variable はハッシュ化されたクラス名で、型にも実行時にも CSS 変数名は現れない。
  // "--font-sans"(shadcn 慣習)や "--font-geist-sans" を書くと読み込んだフォントが効かないので、
  // 設定ファイルのソースから variable: "..." リテラルを拾って検査する(下流 fork でもこのテストは有効)。
  const source = stripComments(fontsConfigSource);
  const names = [...source.matchAll(/\bvariable\s*:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  const allowed = new Set([FONT_SANS_LOADED_VAR, FONT_MONO_LOADED_VAR]);
  const invalid = names.filter((n) => !allowed.has(n));
  assert.deepEqual(
    invalid,
    [],
    `fonts.config.ts の variable 名が固定名以外: ${invalid.join(", ")}。` +
      `sans は "${FONT_SANS_LOADED_VAR}"、mono は "${FONT_MONO_LOADED_VAR}" をリテラルで書くこと`,
  );
});
