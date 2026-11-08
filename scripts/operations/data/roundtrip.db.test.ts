// scripts/operations/data/roundtrip.db.test.ts — pnpm test --db scripts/operations/data/roundtrip.db.test.ts
// pnpm ops data の実 DB の往復(本物のコマンドを子のプロセスで打つ。開発 DB、既定の向き先):
// sample の一時の行 → export → delete(ソフト削除)→ 同じ delete は止める鍵で拒否 → import で戻す(型・配列・日時・null がぴったり)
// → update で列を変える → 記録(task_runs kind data)。user は import / delete を理由つきで止める。
// 一時の行と一時のファイルは終わりに消す(task_runs と監査の行は記録として残る)。DATABASE_URL が無ければ skip

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { config as loadEnv } from "dotenv";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const envFile = path.resolve(ROOT, ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });
const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const dir = mkdtempSync(path.join(tmpdir(), "ops-data-"));
const NAME = `ops-data-test:${randomUUID().slice(0, 8)}`;

type Row = Record<string, unknown>;
let sampleService: { create: (d: Row) => Promise<Row>; getWithDeleted: (id: string) => Promise<Row | undefined>; hardDelete: (id: string) => Promise<unknown> };
let rowId: string;
let original: Row;

const ops = (...args: string[]) => {
  const env = { ...process.env };
  delete env.APP_ENV;
  delete env.ENV_FILE;
  const r = spawnSync("pnpm", ["-s", "ops", "data", ...args], { cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};
// 比べる列(更新の時刻は書くたびに変わるので外す)
const comparable = (row: Row | undefined) => {
  const { updatedAt: _u, ...rest } = row ?? {};
  return rest;
};

describe("pnpm ops data(実 DB の往復)", { skip }, () => {
  before(async () => {
    sampleService = (await import("@/features/sample/services/server/sampleService")).sampleService as never;
    const created = await sampleService.create({
      name: NAME,
      number: 7,
      switch: true,
      radio: false,
      select: "apple",
      multi_select: ["apple", "orange"],
      sale_start_at: new Date("2026-11-08T01:02:03.000Z"),
      date: "2026-11-08",
      time: "12:34:00",
      description: null,
    });
    rowId = String(created.id);
    original = (await sampleService.getWithDeleted(rowId)) as Row;
  });
  after(async () => {
    if (rowId) await sampleService.hardDelete(rowId).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    // eslint-disable-next-line import-boundaries/tools-no-db-write -- テストの後始末: 接続を閉じるだけ(書かない。開いたままだとプロセスが終わらない)
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("export → delete → (同じ delete は拒否)→ import で型・配列・日時・null がぴったり戻る → update", async () => {
    const out = path.join(dir, "samples.jsonl");
    const exported = ops("export", "sample", "--out", out);
    assert.equal(exported.status, 0, exported.out);
    const line = readFileSync(out, "utf8").split("\n").find((l) => l.includes(rowId));
    assert.ok(line, "一時の行が書き出されている");
    const one = path.join(dir, "one.jsonl");
    writeFileSync(one, `${line}\n`);

    const dry = ops("delete", "sample", "--ids", rowId, "--dry-run");
    assert.equal(dry.status, 0, dry.out);
    assert.equal((await sampleService.getWithDeleted(rowId))?.deletedAt ?? null, null, "dry-run は消さない");
    const deleted = ops("delete", "sample", "--ids", rowId);
    assert.equal(deleted.status, 0, deleted.out);
    assert.ok((await sampleService.getWithDeleted(rowId))?.deletedAt, "ソフト削除された");
    const again = ops("delete", "sample", "--ids", rowId);
    assert.equal(again.status, 1);
    assert.match(again.out, /同じ中身の書き込みが成功済み/);

    const imported = ops("import", "sample", "--file", one);
    assert.equal(imported.status, 0, imported.out);
    assert.deepEqual(comparable(await sampleService.getWithDeleted(rowId)), comparable(original), "往復で戻る(deletedAt も null に戻る)");

    const change = path.join(dir, "change.jsonl");
    writeFileSync(change, `${JSON.stringify({ id: rowId, number: 42, description: "変えた" })}\n`);
    const updated = ops("update", "sample", "--file", change);
    assert.equal(updated.status, 0, updated.out);
    const after = await sampleService.getWithDeleted(rowId);
    assert.deepEqual([after?.number, after?.description, after?.name], [42, "変えた", NAME]);
  });

  test("止める: user の import / delete は理由つき、知らないドメイン、引数の誤り(どれも記録の前)", () => {
    const file = path.join(dir, "u.jsonl");
    writeFileSync(file, `${JSON.stringify({ id: randomUUID(), name: "x" })}\n`);
    const imp = ops("import", "user", "--file", file);
    assert.equal(imp.status, 1);
    assert.match(imp.out, /user で import はできません: 管理 API の import が "none"/);
    const del = ops("delete", "user", "--ids", randomUUID());
    assert.equal(del.status, 1);
    assert.match(del.out, /user で delete はできません: サービスに bulkDeleteByIds がありません/);
    assert.match(ops("export", "nope", "--out", path.join(dir, "x")).out, /知らないドメインです: nope/);
    assert.match(ops("update", "sample").out, /--file <file.jsonl> は必須/);
  });
});
