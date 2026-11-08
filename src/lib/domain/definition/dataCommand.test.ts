// src/lib/domain/definition/dataCommand.test.ts — pnpm test src/lib/domain/definition/dataCommand.test.ts
// データ操作のコマンドの許可(resolveDataCommand): API の規則から・上書きの欄・サービスに無い関数は止める(偽のサービスで確かめる)

import assert from "node:assert/strict";
import { test } from "node:test";

import type { DomainApiAccessConfig } from "../types/apiAccess";
import { DATA_COMMAND_OPERATIONS, isDataCommand, resolveDataCommand } from "./dataCommand";

const ADMIN = { roleCategories: ["admin"] };
const fullService = { search: () => {}, bulkUpsert: () => {}, bulkUpdate: () => {}, bulkDeleteByIds: () => {} };

test("対応: export → search、import → bulkUpsert、update → bulkUpdate、delete → bulkDeleteByIds", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(DATA_COMMAND_OPERATIONS).map(([c, v]) => [c, [v.operation, v.method]])),
    { export: ["export", "search"], import: ["import", "bulkUpsert"], update: ["bulkUpdate", "bulkUpdate"], delete: ["bulkDeleteByIds", "bulkDeleteByIds"] },
  );
  assert.equal(isDataCommand("update"), true);
  assert.equal(isDataCommand("truncate"), false);
});

test("API の規則に従う: 誰かに許していれば許す、none なら止める(export / import は書かなければ none)", () => {
  const access: DomainApiAccessConfig = { read: ADMIN, write: ADMIN, operations: { export: ADMIN } };
  assert.deepEqual(resolveDataCommand(access, "export", fullService), { allowed: true, method: "search" });
  const importDenied = resolveDataCommand(access, "import", fullService);
  assert.equal(importDenied.allowed, false);
  assert.match((importDenied as { why: string }).why, /import が "none"/);
  assert.deepEqual(resolveDataCommand(access, "update", fullService), { allowed: true, method: "bulkUpdate" }, "bulkUpdate は write の規則に倒れる");
  assert.deepEqual(resolveDataCommand({ ...access, operations: { ...access.operations, bulkDeleteByIds: "none" } }, "delete", fullService).allowed, false);
  assert.deepEqual(resolveDataCommand({ read: "public", write: { roles: ["editor"] } }, "update", fullService), { allowed: true, method: "bulkUpdate" });
});

test("INTERNAL_ONLY(read / write = none)は 4 つとも閉じる。登録表で引けることは許可ではない", () => {
  const internal: DomainApiAccessConfig = { read: "none", write: "none" };
  for (const command of ["export", "import", "update", "delete"] as const) assert.equal(resolveDataCommand(internal, command, fullService).allowed, false, command);
});

test("上書きの欄 access.commands: allow は API が none でも許す、deny は API が許しても止める", () => {
  const closed: DomainApiAccessConfig = { read: "none", write: "none", commands: { export: "allow" } };
  assert.deepEqual(resolveDataCommand(closed, "export", fullService), { allowed: true, method: "search" });
  const open: DomainApiAccessConfig = { read: ADMIN, write: ADMIN, commands: { delete: "deny" } };
  assert.match((resolveDataCommand(open, "delete", fullService) as { why: string }).why, /access.commands.delete = "deny"/);
});

test("fail-closed: 許可されてもサービスに関数が無ければ止める(サービスが無い・関数でない も)", () => {
  const access: DomainApiAccessConfig = { read: ADMIN, write: ADMIN };
  const { bulkDeleteByIds: _drop, ...noDelete } = fullService;
  assert.match((resolveDataCommand(access, "delete", noDelete) as { why: string }).why, /bulkDeleteByIds がありません/);
  assert.equal(resolveDataCommand(access, "update", null).allowed, false);
  assert.equal(resolveDataCommand(access, "update", { bulkUpdate: 1 }).allowed, false);
  assert.equal(resolveDataCommand({ ...access, commands: { delete: "allow" } }, "delete", noDelete).allowed, false, "allow でも関数が無ければ止める");
});
