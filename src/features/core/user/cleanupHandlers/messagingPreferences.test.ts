// 退会の後片付けの項目 messagingPreferences の検査(messaging の service は偽物)
// - required(失敗したら退会ごと戻す)で、本人の好みの行を同じ取引の中で消す
// - 生成の一覧(extensions/cleanupHandlers.ts)に載っている
// 実行: pnpm test src/features/core/user/cleanupHandlers/messagingPreferences.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const deleted: [string, unknown][] = [];
mock.module("@/features/core/messaging/services/server", {
  namedExports: {
    deletePreferencesOfUser: async (userId: string, tx: unknown) => {
      deleted.push([userId, tx]);
    },
  },
});

let handler: typeof import("./messagingPreferences").handler;
before(async () => {
  ({ handler } = await import("./messagingPreferences"));
});

test("required で、本人の好みの行を渡された取引で消す", async () => {
  assert.equal(handler.required, true);
  const tx = { marker: "tx" };
  await handler.run("u1", tx as never);
  assert.deepEqual(deleted, [["u1", tx]]);
});

test("生成の一覧に載っている", () => {
  const generated = readFileSync(path.join(__dirname, "../extensions/cleanupHandlers.ts"), "utf8");
  assert.match(generated, /cleanupHandlers\/messagingPreferences"/);
  assert.match(generated, /cleanupHandlers_messagingPreferences,/);
});
