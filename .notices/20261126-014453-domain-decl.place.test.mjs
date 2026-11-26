// .notices/20261126-014453-domain-decl.place.mjs の検査(置き場の計画と名前の守り。ファイルの中身だけで確かめる)。
// 実行: pnpm test .notices/20261126-014453-domain-decl.place.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkExports, exportedNamesOf, junctionTablesOf, planPlacement, planReaders } from "./20261126-014453-domain-decl.place.mjs";

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
  assert.match(plan.writes[`${domainRel}/entities/drizzle.ts`], /^\/\/ 生成物・編集不可: pnpm generate registry/);
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

test("表を持つ手のファイルは種類で分けて消し、どの表にも付かない文はドメイン全体の物へ", () => {
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
  assert.deepEqual(stray.stops, []);
  assert.match(stray.writes[`${domainRel}/constants/domain.ts`], /export const helper = 1;/);
  assert.match(stray.writes[`${domainRel}/entities/delivery/drizzle.ts`], /export const DeliveryTable = 2;/);
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

test("どの表にも属さない文: 登録 1 つでも、型は types/domain.ts、定数と入力の形は constants/domain.ts へ抜き、使わなくなった import を落とす", () => {
  const files = {
    "model.ts": 'import type { InferSelectModel } from "drizzle-orm";\nimport type { WidgetTable } from "./drizzle";\nexport type Widget = InferSelectModel<typeof WidgetTable>;\nexport type SeriesPoint = { day: string; count: number };\nexport const MAX_ITEMS = 10;\n',
    "schema.ts": 'import { z } from "zod";\nexport const WidgetSchema = z.object({});\nexport const PingSchema = z.object({ at: z.string() });\nexport type PingInput = z.infer<typeof PingSchema>;\n',
  };
  const input = { domainRel, registrations: [{ name: "widget", table: "widgets" }], files };
  const plan = planPlacement(input);
  assert.deepEqual(plan.stops, []);
  const model = plan.writes[`${domainRel}/entities/widget/model.ts`];
  assert.match(model, /export type Widget = /);
  assert.doesNotMatch(model, /SeriesPoint|MAX_ITEMS/);
  const types = plan.writes[`${domainRel}/types/domain.ts`];
  assert.match(types, /export type SeriesPoint = /);
  assert.match(types, /export type PingInput = z\.infer<typeof PingSchema>;/);
  assert.match(types, /import type \{ PingSchema \} from "\.\.\/constants\/domain";/, "types の import は全部 import type");
  assert.match(types, /import type \{ z \} from "zod";/);
  const constants = plan.writes[`${domainRel}/constants/domain.ts`];
  assert.match(constants, /export const MAX_ITEMS = 10;/);
  assert.match(constants, /export const PingSchema = z\.object/);
  assert.match(constants, /import \{ z \} from "zod";/);
  assert.doesNotMatch(plan.writes[`${domainRel}/entities/widget/schema.ts`], /PingSchema/);
  assert.deepEqual([...plan.moved.keys()].sort(), ["MAX_ITEMS", "PingInput", "PingSchema", "SeriesPoint"]);
  assert.deepEqual(checkExports(input, plan), [], "移った名前は入口から消えてよい");

  const clash = planPlacement({ ...input, domainFiles: { "constants/domain.ts": "export const MAX_ITEMS = 5;\n" } });
  assert.match(clash.stops.join("\n"), /今のファイルに同じ名前がある: MAX_ITEMS/);
  const append = planPlacement({ ...input, domainFiles: { "constants/domain.ts": 'import { a } from "./a";\n\nexport const OTHER = a;\n' } });
  assert.match(append.writes[`${domainRel}/constants/domain.ts`], /^import \{ a \} from "\.\/a";\nimport \{ z \} from "zod";\n\nexport const OTHER = a;\n\nexport const PingSchema = [\s\S]*\n\nexport const MAX_ITEMS = 10;\n$/);
});

test("読み手の書き換え: entities/ 経由で移った名前を読む import を新しい道へ分け、消す手のファイルの道は集める入口へ", () => {
  const plan = {
    domainRel,
    writes: {},
    removes: [`${domainRel}/entities/delivery.ts`],
    moved: new Map([["MAX_ITEMS", { file: "constants/domain", typeOnly: false }], ["SeriesPoint", { file: "types/domain", typeOnly: true }]]),
  };
  const readers = {
    "src/app/x.ts": 'import { WidgetTable, MAX_ITEMS } from "@/domains/widget/entities/drizzle";\nimport type { Widget, SeriesPoint as P } from "@/domains/core/widget/entities";\n',
    [`${domainRel}/services/server/a.ts`]: 'import { MAX_ITEMS } from "../../entities/model";\nimport { DeliveryTable } from "../../entities/delivery";\nconst t = await import("../../entities/delivery");\n',
    "src/registry/schemaRegistry.ts": '// 生成物・編集不可: x\nexport * from "@/domains/widget/entities/delivery";\n',
    "src/other.ts": 'export * from "@/domains/widget/entities/model";\n',
  };
  const out = planReaders("/repo", plan, readers);
  assert.equal(out.writes["src/app/x.ts"], 'import { WidgetTable } from "@/domains/widget/entities/drizzle";\nimport { MAX_ITEMS } from "@/domains/widget/constants/domain";\nimport type { Widget } from "@/domains/core/widget/entities";\nimport type { SeriesPoint as P } from "@/domains/core/widget/types/domain";\n');
  assert.equal(out.writes[`${domainRel}/services/server/a.ts`], 'import { MAX_ITEMS } from "../../constants/domain";\nimport { DeliveryTable } from "../../entities/drizzle";\nconst t = await import("../../entities/drizzle");\n');
  assert.deepEqual(out.generated, ["src/registry/schemaRegistry.ts"], "生成物は書かず生成器で");
  assert.match(out.stops.join("\n"), /src\/other\.ts: export \* from/);
});

test("belongsToMany の中間の表は持ち主の登録へ(自分の登録が無い時)", () => {
  assert.deepEqual(junctionTablesOf({ singular: "gachaMachine", relations: [{ domain: "gachaMachineTag", relationType: "belongsToMany" }, { domain: "x", relationType: "belongsTo" }] }), ["gacha_machine_to_gacha_machine_tag"]);
  const files = {
    "drizzle.ts": [
      'import { pgTable, uuid } from "drizzle-orm/pg-core";',
      'export const WidgetTable = pgTable("widgets", { id: uuid("id") });',
      'export const WidgetToTagTable = pgTable("widget_to_tag", { widgetId: uuid("widget_id") });',
      'export const WidgetHistoryTable = pgTable("widget_histories", { id: uuid("id") });',
      "",
    ].join("\n"),
  };
  const plan = planPlacement({ domainRel, registrations: [{ name: "widget", table: "widgets", junctions: ["widget_to_tag"] }, { name: "widgetHistory", table: "widget_histories" }], files });
  assert.deepEqual(plan.stops, []);
  assert.match(plan.writes[`${domainRel}/entities/widget/drizzle.ts`], /WidgetToTagTable = pgTable\("widget_to_tag"/);
});
