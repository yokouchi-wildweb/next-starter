// scripts/structure/registry/dataCommands.test.mts — pnpm test scripts/structure/registry/dataCommands.test.mts
// 登録表の全ドメインについて、データ操作のコマンド(pnpm ops data export|import|update|delete)の許可を resolveDataCommand で解く。
// 「登録表で引ける(getService)」ことと「汎用のデータ操作として許す」ことを分けて確かめる(D72):
// - user: export は許す、import は閉じる(operations.import none)、update は userService.bulkUpdate(列を限った安全なラッパー)、
//   delete は閉じる(userService は bulkDeleteByIds を公開しない)
// - INTERNAL_ONLY のドメイン(taskRun・auditLog)は 4 つとも閉じる
// - 許すなら、その関数がサービスに本当にある(fail-closed の裏を取る)
// サービスは遅延読み込みを実際に読む(DB には繋がない)。結果の表は失敗の時に読む

import assert from "node:assert/strict";
import { test } from "node:test";

type Resolution = { allowed: true; method: string } | { allowed: false; why: string };

test("データ操作のコマンドの許可: 全ドメインを解き、user と INTERNAL_ONLY を固定する", async () => {
  const { serviceRegistry } = await import("@/registry/serviceRegistry");
  const { DATA_COMMANDS, resolveDataCommand } = await import("@/lib/domain");
  const { getService, getDomainAccess } = await import("@/wiring/domainRegistry");

  const table: Record<string, Record<string, string>> = {};
  for (const key of Object.keys(serviceRegistry).sort()) {
    const access = getDomainAccess(key);
    assert.ok(access, `${key}: access がありません`);
    const service = await getService(key);
    assert.ok(service, `${key}: サービスを読めません(登録表で引けること自体の確かめ)`);
    table[key] = {};
    for (const command of DATA_COMMANDS) {
      const result: Resolution = resolveDataCommand(access, command, service);
      if (result.allowed) assert.equal(typeof (service as Record<string, unknown>)[result.method], "function", `${key} ${command}`);
      table[key][command] = result.allowed ? `allow:${result.method}` : "deny";
    }
  }

  const failMessage = `\n${Object.entries(table).map(([key, row]) => `${key}: ${JSON.stringify(row)}`).join("\n")}`;
  assert.deepEqual(table.user, { export: "allow:search", import: "deny", update: "allow:bulkUpdate", delete: "deny" }, failMessage);
  for (const internal of ["taskRun", "auditLog"]) {
    assert.deepEqual(table[internal], { export: "deny", import: "deny", update: "deny", delete: "deny" }, `${internal}${failMessage}`);
  }
});

test("userService は条件での一括更新と物理の一括削除を公開しない(update ラッパー・softDelete を通らない抜け道)", async () => {
  const { userService } = await import("@/features/core/user/services/server/userService");
  for (const name of ["bulkUpdateByQuery", "bulkHardDeleteByIds", "upsert", "bulkUpsert", "replaceByQuery", "duplicate", "bulkDeleteByIds", "bulkDeleteByQuery"]) {
    assert.equal(name in userService, false, name);
  }
  assert.equal(typeof userService.bulkUpdate, "function", "列を限った安全なラッパーは残る");
});
