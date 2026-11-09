// src/features/core/taskRun/services/server/taskRunService.db.test.ts
// taskRunService の実 DB テスト(task_runs の書き込み・鍵を持つ行の検索・結果の書き直し)。
// 開発 DB の task_runs に、名前 `test:<乱数>` と鍵 `test-key:<乱数>` の行を作り、終了時に消す。
// DATABASE_URL が無ければ全件 skip。表が無ければ失敗する(先に pnpm db:push)。
// 実行: pnpm test --db src/features/core/taskRun/services/server/taskRunService.db.test.ts

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

type Service = typeof import("./taskRunService");

const NAME = `test:${randomUUID().slice(0, 8)}`;
const KEY = `test-key:${randomUUID()}`;
const META = { gitSha: null, gitDirty: null, actor: "test@host", stage: "development", dbTarget: null, fileHash: null };

let service: Service;
let cleanup: () => Promise<void>;

describe("taskRunService(実 DB)", { skip }, () => {
  before(async () => {
    service = await import("./taskRunService");
    const { db } = await import("@/lib/drizzle");
    const { eq } = await import("drizzle-orm");
    const { TaskRunTable } = await import("@/features/taskRun/entities/drizzle");
    cleanup = async () => {
      await db.delete(TaskRunTable).where(eq(TaskRunTable.name, NAME));
      // 接続を閉じる(開いたままだとテストのプロセスが終わらない)
      await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
    };
  });
  after(async () => {
    if (cleanup) await cleanup();
  });

  test("running の行を書き、結果を書くと鍵を持つ。failed にした行と dry-run の行は鍵を持たない", async () => {
    const run = await service.startRun({ ...META, name: NAME, kind: "task", args: ["--all"], dryRun: false, stopKeys: [KEY] });
    assert.equal(run.status, "running");
    assert.deepEqual((await service.findKeyHolders([KEY])).map((r) => r.id), [run.id], "running も鍵を持つ");

    const done = await service.finishRun(run.id, { status: "succeeded", result: { n: 1 } });
    assert.deepEqual([done?.status, done?.result], ["succeeded", { n: 1 }]);
    assert.equal(await service.finishRun(run.id, { status: "failed" }), null, "running でない行は書き換えない");

    const dry = await service.startRun({ ...META, name: NAME, kind: "task", args: ["--dry-run"], dryRun: true, stopKeys: [KEY] });
    await service.finishRun(dry.id, { status: "succeeded" });
    assert.deepEqual((await service.findKeyHolders([KEY, "other"])).map((r) => r.id), [run.id]);
  });

  test("git に入れない移行: 全文を source に残し、同じ名前・同じ中身の成功した dry-run だけを findDryRunOf が返す", async () => {
    const source = "export const task = {};\n";
    const hash = `h-${randomUUID()}`;
    assert.equal(await service.findDryRunOf(NAME, hash), null);
    const dry = await service.startRun({ ...META, fileHash: hash, source, name: NAME, kind: "migration", args: ["--dry-run"], dryRun: true, stopKeys: [] });
    assert.equal(dry.source, source);
    assert.equal(await service.findDryRunOf(NAME, hash), null, "running の dry-run はまだ条件にならない");
    await service.finishRun(dry.id, { status: "succeeded" });
    assert.equal((await service.findDryRunOf(NAME, hash))?.id, dry.id);
    assert.equal(await service.findDryRunOf(NAME, `${hash}-other`), null, "中身が違えば別");
    const plain = await service.startRun({ ...META, name: NAME, kind: "task", args: [], dryRun: false, stopKeys: [] });
    assert.equal(plain.source, null);
  });

  test("resolve: unknown の行を人が failed にすると鍵を放す。succeeded の行は書き直せない", async () => {
    const key = `${KEY}:resolve`;
    const run = await service.startRun({ ...META, name: NAME, kind: "migration", args: [], dryRun: false, stopKeys: [key] });
    await service.finishRun(run.id, { status: "unknown", error: "途中で切れた" });
    assert.equal((await service.findKeyHolders([key])).length, 1);
    const resolved = await service.resolveRun(run.id, "failed", "resolved by hand: failed (test)");
    assert.equal(resolved.status, "failed");
    assert.ok(resolved.resolvedAt instanceof Date);
    assert.match(resolved.error ?? "", /途中で切れた\nresolved by hand/);
    assert.equal((await service.findKeyHolders([key])).length, 0);

    const ok = await service.startRun({ ...META, name: NAME, kind: "task", args: [], dryRun: false, stopKeys: [] });
    await service.finishRun(ok.id, { status: "succeeded" });
    await assert.rejects(service.resolveRun(ok.id, "failed", "x"), /succeeded です/);
  });
});
