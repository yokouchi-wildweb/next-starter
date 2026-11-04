// 実行: pnpm test:frame-declaration
// 部位の一覧(./parts.mjs)が 1 か所にあり、枠の実物と宣言の型に合うことを見る(指令 07 d5)。
// 利用者の枠の部品との照合は (user)/_layout の UserFrame.test、管理の枠は指令 09、data-slot と実物の照合は data-slot を付ける指令(10)
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { FRAME_ROOTS, FRAME_SLOTS, hideableParts } from "./parts.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (path) => readFileSync(join(repoRoot, path), "utf8");

test("一覧: 31 名・重なりなし・kebab-case・管理の枠は admin-", () => {
  const names = FRAME_SLOTS.map((s) => s.name);
  assert.equal(names.length, 31);
  assert.equal(new Set(names).size, names.length);
  for (const s of FRAME_SLOTS) {
    assert.match(s.name, /^[a-z]+(?:-[a-z]+)*$/, s.name);
    if (s.area === "admin") assert.ok(s.name.startsWith("admin-"), s.name);
    if (s.area === "user" || s.area === "main") assert.ok(!s.name.startsWith("admin-"), s.name);
    if (s.hideable) assert.ok(s.area === "user" || s.area === "admin", `${s.name}: 隠せるのは枠の部位だけ`);
  }
});

test("隠せる部位: 利用者の 4 つ(D90)と管理の 3 つ、宣言のキーは接頭辞を除いた camelCase", () => {
  assert.deepEqual(hideableParts("user"), [
    { key: "header", slot: "header" },
    { key: "headerNav", slot: "header-nav" },
    { key: "footer", slot: "footer" },
    { key: "bottomNav", slot: "bottom-nav" },
  ]);
  assert.deepEqual(hideableParts("admin"), [
    { key: "header", slot: "admin-header" },
    { key: "sidebar", slot: "admin-sidebar" },
    { key: "footer", slot: "admin-footer" },
  ]);
});

test("宣言の型(./types.ts)のキーの union = 隠せる部位のキー", () => {
  const types = read("src/app/_layout/frame/types.ts");
  const unionOf = (name) => [...new RegExp(`export type ${name} = ([^;]+);`).exec(types)[1].matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(unionOf("UserFrameKey"), hideableParts("user").map((p) => p.key));
  assert.deepEqual(unionOf("AdminFrameKey"), hideableParts("admin").map((p) => p.key));
});

test("枠の根: 枠の layout があるフォルダ", () => {
  for (const { dir } of Object.values(FRAME_ROOTS)) assert.ok(readdirSync(join(repoRoot, dir)).includes("layout.tsx"), dir);
});
