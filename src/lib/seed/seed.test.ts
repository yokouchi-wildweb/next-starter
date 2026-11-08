// src/lib/seed/seed.test.ts — pnpm test src/lib/seed
// defineSeed の形の検査・planSeeds の順と止める理由・resolveRow の置き換え。
import assert from "node:assert/strict";
import { test } from "node:test";

import { defineSeed, planSeeds, ref, resolveRow, type SeedEntry } from "./index";

const entry = (domain: string, seed: ReturnType<typeof defineSeed>, closedBy: string | null = null): SeedEntry => ({ domain, folder: domain, file: `src/features/${domain}/seed.ts`, seed, closedBy });

test("defineSeed: $key の形・ドメインの中の重複・$unique の列が行に無いと止める", () => {
  assert.throws(() => defineSeed({ tables: { t: [{ $key: "" }] } }), /\$key/);
  assert.throws(() => defineSeed({ tables: { t: [{ $key: "a" }], u: [{ $key: "a" }] } }), /2 つあります/);
  assert.throws(() => defineSeed({ tables: { t: [{ $key: "a", $unique: ["name"] }] } }), /\$unique の列 name/);
  assert.ok(defineSeed({ tables: { t: [{ $key: "a", $unique: ["name"], name: "x" }] } }));
});

test("planSeeds: after の順、選んだドメインの after を自動で足す", () => {
  const a = entry("a", defineSeed({ tables: { ta: [{ $key: "x" }] } }));
  const b = entry("b", defineSeed({ after: ["a"], tables: { tb: [{ $key: "y", a: ref("a", "x") }] } }));
  const c = entry("c", defineSeed({ after: ["b"], tables: { tc: [{ $key: "z" }] } }));
  assert.deepEqual(planSeeds([c, b, a]).order.map((e) => e.domain), ["a", "b", "c"]);
  assert.deepEqual(planSeeds([c, b, a], ["b"]).order.map((e) => e.domain), ["a", "b"]);
});

test("planSeeds: 止める理由(知らない after・循環・after に無い ref・無い $key)", () => {
  const problems = (entries: SeedEntry[]) => planSeeds(entries).problems.join("\n");
  assert.match(problems([entry("a", defineSeed({ after: ["nope"], tables: {} }))]), /after の nope にシードがありません/);
  assert.match(problems([entry("a", defineSeed({ after: ["b"], tables: {} })), entry("b", defineSeed({ after: ["a"], tables: {} }))]), /循環/);
  assert.match(problems([entry("a", defineSeed({ tables: { t: [{ $key: "x" }] } })), entry("b", defineSeed({ tables: { t: [{ $key: "y", r: ref("a", "x") }] } }))]), /ref\(a, x\) のドメインが after にありません/);
  assert.match(problems([entry("a", defineSeed({ tables: { t: [{ $key: "x" }] } })), entry("b", defineSeed({ after: ["a"], tables: { t: [{ $key: "y", r: [ref("a", "nope")] }] } }))]), /ref\(a, nope\) の \$key がありません/);
});

test("planSeeds: 閉じたドメインは飛ばし、それを after に持つ開いたシードは止める(自分も閉じていれば飛ばすだけ)", () => {
  const tag = entry("tag", defineSeed({ tables: { t: [{ $key: "x" }] } }), "sampleDomain");
  const item = entry("item", defineSeed({ after: ["tag"], tables: { i: [{ $key: "y" }] } }));
  const closedItem = entry("item", defineSeed({ after: ["tag"], tables: { i: [{ $key: "y" }] } }), "sampleDomain");
  const open = planSeeds([tag, item]);
  assert.deepEqual(open.skipped, [{ domain: "tag", closedBy: "sampleDomain" }]);
  assert.match(open.problems.join("\n"), /tag が閉じた機能なので入れられません/);
  const both = planSeeds([tag, closedItem]);
  assert.deepEqual([both.problems, both.skipped.map((s) => s.domain)], [[], ["tag", "item"]]);
});

test("resolveRow: $ の欄を外し、ref(配列の中も)を id に置き換え、まだ無い ref は止める", () => {
  const ids = new Map([["a:x", "id-1"]]);
  assert.deepEqual(resolveRow({ $key: "y", $unique: ["name"], name: "n", a: ref("a", "x"), list: [ref("a", "x")] }, ids), { name: "n", a: "id-1", list: ["id-1"] });
  assert.throws(() => resolveRow({ $key: "y", a: ref("a", "z") }, ids), /まだ入っていません/);
});
