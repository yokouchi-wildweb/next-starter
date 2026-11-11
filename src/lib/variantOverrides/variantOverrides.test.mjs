// variant オーバーライドの契約テスト。
// 実行: pnpm test src/lib/variantOverrides/variantOverrides.test.mjs (node:test + tsx)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cva } from "class-variance-authority";

import { cn } from "../cn/index.ts";
import { defineVariantOverrides, variantOverrideClasses } from "./defineConfig.ts";
import { createOverridableVariants } from "./createOverridableVariants.ts";

const here = dirname(fileURLToPath(import.meta.url));

const BASE = "inline-flex rounded-md";
const CONFIG = {
  variants: {
    variant: { default: "bg-primary text-primary-foreground", outline: "border bg-background" },
    size: { sm: "h-9 px-3", md: "h-10 px-4" },
  },
  defaultVariants: { variant: "default", size: "md" },
};
const make = (override) => createOverridableVariants(BASE, CONFIG, override);

test("defineVariantOverrides は未指定キーを空オブジェクトで埋める(消費側が ?. 無しで参照できる)", () => {
  assert.deepEqual(defineVariantOverrides({}), {
    button: {},
    tabletButton: {},
    badge: { size: {}, solid: {}, soft: {}, bookmarkTag: {} },
    booleanCheckbox: {},
    booleanRadioGroup: {},
    singleCardCheckbox: {},
    stepperInput: {},
    switchInput: { track: {}, indicator: {} },
    pageTitle: {},
    para: {},
    secTitle: {},
    span: {},
  });
  assert.deepEqual(defineVariantOverrides(), defineVariantOverrides({}));
  const partial = defineVariantOverrides({
    button: { base: "rounded-full" },
    badge: { soft: { base: "uppercase" } },
    switchInput: { track: { base: "T" } },
  });
  assert.deepEqual(partial.switchInput, { track: { base: "T" }, indicator: {} });
  assert.equal(partial.button.base, "rounded-full");
  assert.deepEqual(partial.badge, { size: {}, solid: {}, soft: { base: "uppercase" }, bookmarkTag: {} });
});

test("variantOverrideClasses は base → variant → size の順で、該当する軸だけ返す", () => {
  const ov = { base: "B", variant: { outline: "V" }, size: { md: "S" } };
  assert.deepEqual(variantOverrideClasses(ov, { variant: "outline", size: "md" }), ["B", "V", "S"]);
  assert.deepEqual(variantOverrideClasses(ov, { variant: "default", size: "sm" }), ["B", undefined, undefined]);
  assert.deepEqual(variantOverrideClasses(ov, { variant: null, size: undefined }), ["B", undefined, undefined]);
  assert.deepEqual(variantOverrideClasses(undefined, { variant: "outline" }), []);
});

test("variantOverrideClasses は variant / size 以外の軸も、渡した順に返す", () => {
  const ov = { base: "B", tone: { muted: "T" }, size: { lg: "S" }, weight: { bold: "W" } };
  assert.deepEqual(variantOverrideClasses(ov, { tone: "muted", size: "lg", weight: "bold" }), ["B", "T", "S", "W"]);
  assert.deepEqual(variantOverrideClasses(ov, { weight: "bold", tone: "muted" }), ["B", "W", "T"]);
  assert.deepEqual(variantOverrideClasses(ov, { tone: null, align: "left" }), ["B", undefined, undefined]);
});

test("createOverridableVariants は cva の variants の全ての軸を解決して上書きを足す(variants の順)", () => {
  const fn = createOverridableVariants(
    "p",
    {
      variants: { tone: { a: "text-red-500", b: "text-blue-500" }, size: { s: "text-sm", l: "text-lg" }, flag: { true: "sr-only", false: "" } },
      defaultVariants: { size: "s" },
    },
    { base: "OB", tone: { b: "OT" }, size: { s: "OS" } },
  );
  assert.equal(fn({ tone: "b" }), "p text-blue-500 text-sm OB OT OS");
  assert.equal(fn({ tone: "a", size: "l", flag: true }), "p text-red-500 text-lg sr-only OB");
  assert.equal(fn({ tone: "b", className: "x" }), "p text-blue-500 text-sm OB OT OS x");
});

test("オーバーライド無しなら cn(cva(...)) と同じ出力(見た目不変の契約)", () => {
  const plain = make({});
  const reference = cva(BASE, CONFIG);
  const cases = [
    undefined,
    {},
    { variant: "outline", size: "sm" },
    { className: "mt-2" },
    { variant: "outline", className: "h-8" },
    { variant: null, size: null },
    { variant: "", size: undefined },
    { class: "rounded-none" },
  ];
  for (const props of cases) {
    assert.equal(plain(props), cn(reference(props)), `props=${JSON.stringify(props)}`);
  }
  assert.equal(plain(), "inline-flex rounded-md bg-primary text-primary-foreground h-10 px-4");
});

test("オーバーライドは cva の出力に後勝ちし、呼び出し側の className はさらに勝つ", () => {
  const fn = make({
    base: "rounded-full shadow-none",
    variant: { outline: "border-2" },
    size: { md: "h-11 px-5" },
  });
  // base: rounded-md → rounded-full、shadow-none が追加
  assert.equal(fn(), "inline-flex bg-primary text-primary-foreground rounded-full shadow-none h-11 px-5");
  // variant: border → border-2(同じ border-width グループで後勝ち)
  assert.equal(fn({ variant: "outline", size: "sm" }), "inline-flex bg-background h-9 px-3 rounded-full shadow-none border-2");
  // className は最後: h-11 → h-8
  assert.equal(
    fn({ className: "h-8" }),
    "inline-flex bg-primary text-primary-foreground rounded-full shadow-none px-5 h-8",
  );
  // cva 互換の class プロップも同じ位置(オーバーライドの後)
  assert.equal(
    fn({ class: "rounded-none" }),
    "inline-flex bg-primary text-primary-foreground shadow-none h-11 px-5 rounded-none",
  );
});

test("variant / size の解決は cva と同じ(undefined / 空文字 → 既定値、null → その軸を当てない)", () => {
  const fn = make({ variant: { default: "V-default" }, size: { md: "S-md" } });
  assert.equal(fn({ variant: undefined, size: undefined }), "inline-flex rounded-md bg-primary text-primary-foreground h-10 px-4 V-default S-md");
  assert.equal(fn({ variant: "", size: "" }), "inline-flex rounded-md bg-primary text-primary-foreground h-10 px-4 V-default S-md");
  assert.equal(fn({ variant: null, size: null }), "inline-flex rounded-md");
});

test("出荷時の variants.config.ts は空(upstream は下流所有ファイルに値を書かない)", () => {
  const source = readFileSync(resolve(here, "../../config/ui/variants.config.ts"), "utf8");
  const body = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(body, /defineVariantOverrides\(\{\s*\}\)/);
});
