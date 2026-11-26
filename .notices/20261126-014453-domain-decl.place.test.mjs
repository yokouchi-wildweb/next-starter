// .notices/20261126-014453-domain-decl.place.mjs の検査(置き場の計画と名前の守り。ファイルの中身だけで確かめる)。
// 実行: pnpm test .notices/20261126-014453-domain-decl.place.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkExports, exportedNamesOf, planPlacement } from "./20261126-014453-domain-decl.place.mjs";

const domainRel = "src/domains/core/widget";

test("登録 1 つ: 4 ファイルを登録のフォルダへ移し、相対の import を 1 段深くし、集める入口を置く", () => {
  const files = {
    "drizzle.ts": '// src/domains/core/widget/entities/drizzle.ts\nimport { pgTable, uuid } from "drizzle-orm/pg-core";\nimport { X } from "../constants";\nexport const WidgetTable = pgTable("widgets", { id: uuid("id") });\n',
    "schema.ts": 'import { z } from "zod";\nimport { WidgetTable } from "./drizzle";\nexport const WidgetSchema = z.object({});\n',
    "index.ts": 'export * from "./drizzle";\n',
    "widgetName.ts": "export const x = 1;\n",
  };
  const input = { domainRel, registrations: [{ name: "widget", table: "widgets" }], files };
  const plan = planPlacement(input);
  assert.deepEqual(plan.stops, []);
  assert.deepEqual(Object.keys(plan.writes).sort(), [
    `${domainRel}/entities/drizzle.ts`, `${domainRel}/entities/schema.ts`, `${domainRel}/entities/widget/drizzle.ts`, `${domainRel}/entities/widget/schema.ts`,
  ]);
  const moved = plan.writes[`${domainRel}/entities/widget/drizzle.ts`];
  assert.match(moved, /^\/\/ src\/domains\/core\/widget\/entities\/widget\/drizzle\.ts\n/);
  assert.match(moved, /from "\.\.\/\.\.\/constants"/);
  assert.match(plan.writes[`${domainRel}/entities/widget/schema.ts`], /from "\.\/drizzle"/, "一緒に移る種類どうしはそのまま");
  assert.match(plan.writes[`${domainRel}/entities/drizzle.ts`], /export \* from "\.\/widget\/drizzle";/);
  assert.match(plan.writes[`${domainRel}/entities/drizzle.ts`], /AUTO-GENERATED/);
  assert.deepEqual(checkExports(input, plan), []);
  assert.deepEqual(planPlacement({ ...input, files: { ...files, ...Object.fromEntries(Object.entries(plan.writes).filter(([rel]) => rel.split("/").length === 6).map(([rel, text]) => [rel.split("/").pop(), text])) } }).writes, {}, "置いた後は何もしない");
});

test("登録が複数: 表・名前の頭・使う名前で文を登録へ分け、登録をまたぐ名前は import する", () => {
  const files = {
    "drizzle.ts": [
      'import { pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";',
      'export const statusEnum = pgEnum("widget_status", ["a", "b"]);',
      'export const WidgetTable = pgTable("widgets", { id: uuid("id"), status: statusEnum("status") });',
      'export const WidgetHistoryTable = pgTable("widget_histories", { id: uuid("id"), widgetId: uuid("widget_id").references(() => WidgetTable.id), status: statusEnum("status"), note: text("note") });',
      "",
    ].join("\n"),
    "model.ts": 'export type Widget = { id: string };\nexport type WidgetHistory = { id: string; widget: Widget };\n',
  };
  const input = { domainRel, registrations: [{ name: "widget", table: "widgets" }, { name: "widgetHistory", table: "widget_histories" }], files };
  const plan = planPlacement(input);
  assert.deepEqual(plan.stops, []);
  const history = plan.writes[`${domainRel}/entities/widgetHistory/drizzle.ts`];
  assert.match(history, /import \{ WidgetTable, statusEnum \} from "\.\.\/widget\/drizzle";/);
  assert.match(history, /import \{ pgTable, text, uuid \} from "drizzle-orm\/pg-core";/);
  assert.match(plan.writes[`${domainRel}/entities/widget/drizzle.ts`], /export const statusEnum = pgEnum/, "enum は先に使う登録へ");
  assert.match(plan.writes[`${domainRel}/entities/widgetHistory/model.ts`], /import type \{ Widget \} from "\.\.\/widget\/model";/);
  assert.match(plan.writes[`${domainRel}/entities/model.ts`], /export \* from "\.\/widget\/model";\nexport \* from "\.\/widgetHistory\/model";/);
  assert.deepEqual(checkExports(input, plan), []);
  assert.deepEqual(plan.tables.sort(), ["widget_histories", "widgets"]);
});

test("表を持つ手のファイルは種類で分けて消し、付けられない文は止める", () => {
  const files = {
    "drizzle.ts": 'export * from "./delivery";\n',
    "delivery.ts": [
      'import { pgTable, uuid } from "drizzle-orm/pg-core";',
      'import { z } from "zod";',
      'export const DeliveryTable = pgTable("deliveries", { id: uuid("id") });',
      "export const DeliveryPayloadSchema = z.object({});",
      "export type DeliveryRow = typeof DeliveryTable.$inferSelect;",
      "",
    ].join("\n"),
  };
  const input = { domainRel, registrations: [{ name: "delivery", table: "deliveries" }, { name: "other", table: "others" }], files };
  const plan = planPlacement(input);
  assert.deepEqual(plan.stops, []);
  assert.deepEqual(plan.removes, [`${domainRel}/entities/delivery.ts`]);
  assert.match(plan.writes[`${domainRel}/entities/delivery/schema.ts`], /DeliveryPayloadSchema/);
  assert.match(plan.writes[`${domainRel}/entities/delivery/model.ts`], /import type \{ DeliveryTable \} from "\.\/drizzle";|import \{ DeliveryTable \} from "\.\/drizzle";/);
  assert.deepEqual(checkExports(input, plan), []);

  const stray = planPlacement({ ...input, files: { "drizzle.ts": 'export const helper = 1;\nexport const DeliveryTable = 2;\n' } });
  assert.match(stray.stops.join("\n"), /export const helper = 1; を登録・種類に付けられない|helper/);
});

test("守り: 集める入口で同じ名前がぶつかる・出していた名前が無くなるのを出す", () => {
  const input = { domainRel, registrations: [], files: { "drizzle.ts": "export const A = 1;\nexport const B = 2;\n" } };
  const plan = {
    writes: {
      [`${domainRel}/entities/drizzle.ts`]: 'export * from "./a/drizzle";\nexport * from "./b/drizzle";\n',
      [`${domainRel}/entities/a/drizzle.ts`]: "export const A = 1;\n",
      [`${domainRel}/entities/b/drizzle.ts`]: "export const A = 2;\n",
    },
    removes: [],
  };
  const problems = checkExports(input, plan);
  assert.ok(problems.some((line) => /名前 A が .* の両方から出る/.test(line)), problems.join(" | "));
  assert.ok(problems.some((line) => /出していた名前が無くなる: B/.test(line)), problems.join(" | "));
  assert.deepEqual([...exportedNamesOf("export { x, y as z };\nexport type T = 1;\n").names].sort(), ["T", "x", "z"]);
});
