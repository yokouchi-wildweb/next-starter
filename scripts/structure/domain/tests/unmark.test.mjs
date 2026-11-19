// scripts/structure/domain/tests/unmark.test.mjs — generate: false のドメインの生成物の印を外す(--unmark、D222)
import { test } from "node:test";
import assert from "node:assert/strict";

import { planUnmark } from "../cli/unmark.mjs";
import { GENERATED_MARK, withGeneratedMark, withoutGeneratedMark } from "../render/output.mjs";

const marked = (path, body) => withGeneratedMark(path, body);
const rows = [
  { kind: "features", name: "booking", dir: "src/features/booking", domainJson: true, generate: false },
  { kind: "features", name: "sample", dir: "src/features/sample", domainJson: true, generate: true },
  { kind: "features", name: "legacy", dir: "src/features/legacy", domainJson: false, generate: null },
];
const texts = {
  "src/features/booking/entities/schema.ts": marked("src/features/booking/entities/schema.ts", "// src/features/booking/entities/schema.ts\nexport const a = 1;\n"),
  "src/features/booking/components/X.tsx": "// hand file that says generated in a comment\nexport const X = 1;\n",
  "src/app/admin/(protected)/bookings/_screen/loader.ts": marked("loader.ts", "export const load = 1;\n"),
  "src/styles/booking.css": marked("src/styles/booking.css", ".a{}\n"),
  "src/features/sample/entities/schema.ts": marked("src/features/sample/entities/schema.ts", "export const s = 1;\n"),
};
const files = Object.keys(texts);
const input = (name) => ({ rows, plurals: { "src/features/booking": "bookings" }, files, readText: (p) => texts[p], name });

test("withoutGeneratedMark: 印の行だけを消し、ほかの行はそのまま(// と /* */ の両方、印が無ければ同じ中身)", () => {
  const ts = "// src/a.ts\nexport const a = 1;\n";
  assert.equal(withoutGeneratedMark(withGeneratedMark("src/a.ts", ts)), ts);
  assert.equal(withoutGeneratedMark(withGeneratedMark("src/a.css", ".a{}\n")), ".a{}\n");
  assert.equal(withoutGeneratedMark(ts), ts);
});

test("planUnmark: generate: false のドメインのフォルダと管理画面のルートの印だけを外す", () => {
  const { domains, writes } = planUnmark(input(null));
  assert.deepEqual(domains, ["booking"]);
  assert.deepEqual(writes.map((w) => w.path).sort(), ["src/app/admin/(protected)/bookings/_screen/loader.ts", "src/features/booking/entities/schema.ts"]);
  for (const w of writes) assert.equal(w.content.includes(GENERATED_MARK), false);
  assert.equal(writes.find((w) => w.path.endsWith("schema.ts")).content, "// src/features/booking/entities/schema.ts\nexport const a = 1;\n");
});

test("planUnmark: 外した後はもう一度でも書く物 0", () => {
  const first = planUnmark(input(null));
  const after = { ...texts };
  for (const w of first.writes) after[w.path] = w.content;
  assert.equal(planUnmark({ ...input(null), readText: (p) => after[p] }).writes.length, 0);
});

test("planUnmark: generate が false でないドメインを名指しすると断る、無いドメインも断る", () => {
  assert.throws(() => planUnmark(input("sample")), /generate が false でない/);
  assert.throws(() => planUnmark(input("nothere")), /domain\.json を持つドメイン nothere が無い/);
  assert.deepEqual(planUnmark(input("Booking")).domains, ["booking"]);
});
