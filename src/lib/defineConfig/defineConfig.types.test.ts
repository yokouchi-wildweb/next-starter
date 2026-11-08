// src/lib/defineConfig/defineConfig.types.test.ts
// defineConfig の型のテスト(pnpm typecheck で確かめる。pnpm test は *.types.test.* を走らせない)。
// 誤りを期待する行(ts-expect-error の印)が誤りにならなくなったら(= 型が緩んだら)tsc が落ちる。
import { defineConfig } from "./index";
import type { OverrideOf } from "./index";

type Area = { key: string; mode: "light" | "dark"; match: string[] };
type Sample = {
  title: string;
  note?: string;
  nested: { a: number; b?: { c: string } };
  tags: string[];
  areas: Area[];
};

const defaults: Sample = {
  title: "t",
  nested: { a: 1 },
  tags: [],
  areas: [{ key: "user", mode: "light", match: ["/"] }],
};

const def = defineConfig(defaults, { arrays: { areas: { by: "key" } } });
type SampleOverride<E extends object = Record<never, never>> = OverrideOf<typeof def, E>;

// 通る: 部分の上書き・省略できるキーの null・id で合わせる配列の部分の項目と $delete
export const ok = {
  title: "x",
  note: null,
  nested: { b: null },
  areas: [{ key: "user", mode: "dark" }, { key: "admin", $delete: true }],
} satisfies SampleOverride;

// 通る: fork 独自のキーは型引数で足す
export const withExtra = { title: "x", myKey: 1 } satisfies SampleOverride<{ myKey: number }>;

// 結果の型 = 既定の型 & Extra
const composed = def.compose<{ myKey: number }>(withExtra);
export const title: string = composed.title;
export const myKey: number = composed.myKey;

// @ts-expect-error 知らないキー(綴りの誤り)は落ちる
export const typo = { titel: "x" } satisfies SampleOverride;

// @ts-expect-error 型の違う値は落ちる
export const wrongType = { nested: { a: "1" } } satisfies SampleOverride;

// @ts-expect-error 省略できないキーは null で消せない
export const nullRequired = { title: null } satisfies SampleOverride;

// @ts-expect-error id で合わせる配列の項目は id が要る
export const noId = { areas: [{ mode: "dark" }] } satisfies SampleOverride;

// @ts-expect-error 規則の無い配列(replace)は項目を丸ごと書く
export const partialReplace = { tags: [1] } satisfies SampleOverride;

// @ts-expect-error compose に直に書く上書きも知らないキーで落ちる(Extra を型引数で書かない限り)
def.compose({ myKey: 1 });

// @ts-expect-error 配列でないキーに配列の規則は書けない
defineConfig(defaults, { arrays: { title: "append" } });

// @ts-expect-error id に使えるのは string / number の値のキーだけ
defineConfig(defaults, { arrays: { areas: { by: "match" } } });
