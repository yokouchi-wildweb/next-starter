// src/lib/defineConfig/defineConfig.test.ts
// defineConfig の合成の契約テスト。実行: pnpm test src/lib/defineConfig (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { ConfigError, ConfigValidationError, defineConfig } from "./index";
import type { StandardSchemaV1 } from "./index";

type Area = { key: string; match: string[]; mode: "light" | "dark" };
type Sample = {
  title: string;
  duration: number;
  note?: string;
  nested: { a: number; b: { c: string; d?: number } };
  tags: string[];
  plugins: string[];
  areas: Area[];
  format: (n: number) => string;
};

const defaults: Sample = {
  title: "default",
  duration: 3000,
  note: "既定の注記",
  nested: { a: 1, b: { c: "x", d: 2 } },
  tags: ["a", "b"],
  plugins: ["core"],
  areas: [
    { key: "user", match: ["/"], mode: "light" },
    { key: "admin", match: ["/admin"], mode: "dark" },
  ],
  format: (n) => `${n}`,
};

const def = defineConfig(defaults, { label: "sample", arrays: { plugins: "append", areas: { by: "key" } } });

test("空の上書きは既定と同じ値を返し、既定を変えない(写しを返す)", () => {
  const value = def.compose({});
  assert.deepEqual({ ...value, format: undefined }, { ...defaults, format: undefined });
  assert.notEqual(value.nested, defaults.nested);
  value.nested.a = 99;
  value.tags.push("z");
  assert.equal(defaults.nested.a, 1);
  assert.deepEqual(defaults.tags, ["a", "b"]);
});

test("深いマージ: 書いたキーだけ変わり、書いていない入れ子は残る。undefined は変えない", () => {
  const value = def.compose({ nested: { b: { c: "y" } }, title: undefined });
  assert.deepEqual(value.nested, { a: 1, b: { c: "y", d: 2 } });
  assert.equal(value.title, "default");
});

test("関数は丸ごと置き換える", () => {
  const format = (n: number) => `#${n}`;
  assert.equal(def.compose({ format }).format, format);
});

test("配列: 規則の無い配列は replace", () => {
  assert.deepEqual(def.compose({ tags: ["c"] }).tags, ["c"]);
});

test("配列: append は既定の後ろに足す", () => {
  assert.deepEqual(def.compose({ plugins: ["fork"] }).plugins, ["core", "fork"]);
});

test("配列: by(id で合わせる)は同じ id を深く合成・位置を保ち、知らない id は末尾に足す", () => {
  const value = def.compose({ areas: [{ key: "admin", mode: "light" }, { key: "shop", match: ["/shop"], mode: "dark" }] });
  assert.deepEqual(value.areas, [
    { key: "user", match: ["/"], mode: "light" },
    { key: "admin", match: ["/admin"], mode: "light" },
    { key: "shop", match: ["/shop"], mode: "dark" },
  ]);
});

test("配列: by の $delete: true は既定の項目を消し、無い id を消そうとすると誤り", () => {
  assert.deepEqual(def.compose({ areas: [{ key: "user", $delete: true }] }).areas.map((a) => a.key), ["admin"]);
  assert.throws(() => def.compose({ areas: [{ key: "nope", $delete: true }] }), ConfigError);
});

test("配列: by の項目に id が無い・オブジェクトでないと誤り", () => {
  assert.throws(() => def.compose({ areas: [{ mode: "dark" } as never] }), /id "key"/);
  assert.throws(() => def.compose({ areas: ["x" as never] }), ConfigError);
});

test("null はそのキーを消す", () => {
  const value = def.compose({ note: null, nested: { b: { d: null } } });
  assert.equal("note" in value, false);
  assert.deepEqual(value.nested.b, { c: "x" });
});

test("既定に無いキー(fork 独自のキー)はそのまま写す", () => {
  const value = def.compose<{ myKey: { on: boolean } }>({ myKey: { on: true } });
  assert.deepEqual(value.myKey, { on: true });
});

test("規則の形が既定に合わないと defineConfig の時点で誤り", () => {
  assert.throws(() => defineConfig(defaults, { arrays: { title: "append" } as never }), /配列ではありません/);
  assert.throws(() => defineConfig(defaults, { arrays: { tags: "merge" } as never }), ConfigError);
});

const zodSchema = z
  .object({
    title: z.string().min(1),
    duration: z.number().int().positive(),
    nested: z.object({ a: z.number() }).passthrough(),
  })
  .passthrough();

test("検査(zod の schema): 通れば合成した値をそのまま返す(fork 独自のキーも残る)", () => {
  const withZod = defineConfig(defaults, { label: "sample", schema: zodSchema });
  const value = withZod.compose<{ extra: string }>({ duration: 500, extra: "残る" });
  assert.equal(value.duration, 500);
  assert.equal(value.extra, "残る");
});

test("検査(zod の schema): 通らなければ ConfigValidationError(パスと文を持つ)", () => {
  const withZod = defineConfig(defaults, { label: "sample", schema: zodSchema });
  assert.throws(
    () => withZod.compose({ duration: -1, title: "" }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigValidationError);
      assert.equal(error.label, "sample");
      assert.deepEqual(error.issues.map((i) => i.path.join(".")).sort(), ["duration", "title"]);
      assert.match(error.message, /^\[sample\]/);
      return true;
    },
  );
});

/** 手書きの Standard Schema: duration は 10 以上 */
const handWritten: StandardSchemaV1 = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate(value) {
      const duration = (value as { duration?: unknown }).duration;
      if (typeof duration === "number" && duration >= 10) return { value };
      return { issues: [{ message: "duration は 10 以上", path: [{ key: "duration" }] }] };
    },
  },
};

test("検査(手書きの Standard Schema): 通る値は通し、通らない値は path 付きで止める", () => {
  const withHand = defineConfig(defaults, { schema: handWritten });
  assert.equal(withHand.compose({ duration: 10 }).duration, 10);
  assert.throws(
    () => withHand.compose({ duration: 1 }),
    (error: unknown) => error instanceof ConfigValidationError && error.issues[0].path[0] === "duration" && error.label === "config",
  );
});

test("検査: 非同期の schema は誤り(設定は同期で合成する)", () => {
  const asyncSchema: StandardSchemaV1 = {
    "~standard": { version: 1, vendor: "test", validate: async (value) => ({ value }) },
  };
  assert.throws(() => defineConfig(defaults, { schema: asyncSchema }).compose({}), /同期/);
});
