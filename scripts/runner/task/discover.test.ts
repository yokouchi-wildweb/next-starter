// scripts/runner/task/discover.test.ts — pnpm test scripts/runner/task/discover.test.ts
// ドメインのタスク・移行の走査(scan.mjs)と読み込み(discover.ts): 名前の形・種類・タスクでない物・止まる置き方・古い置き場の残り。
// 一時のフォルダに木を作って確かめる(リポジトリの本物の木は最後の 1 件だけ)。

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { listOneShotTasks, loadOneShotTask } from "./discover";
import { cronTaskNames, scanTasks, taskNamesIn } from "./scan.mjs";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const taskBody = (name: string) => `export const task = { name: ${JSON.stringify(name)}, run: async () => ({ ok: true }) };\n`;

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "task-scan-"));
  roots.push(root);
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), body);
  }
  return root;
}

test("core と業務のドメインのタスク・移行を <ドメイン>:<名前> で集め、種類を分ける", () => {
  const root = tree({
    "src/features/core/wallet/scripts/tasks/lots-init.ts": taskBody("wallet:lots-init"),
    "src/features/core/setting/scripts/migrations/copy-list-per-page.ts": taskBody("setting:copy-list-per-page"),
    "src/features/shop/scripts/tasks/lots-init.ts": taskBody("shop:lots-init"),
  });
  assert.deepEqual(listOneShotTasks(root), [
    { name: "setting:copy-list-per-page", domain: "setting", kind: "migration", file: "src/features/core/setting/scripts/migrations/copy-list-per-page.ts", local: false },
    { name: "shop:lots-init", domain: "shop", kind: "task", file: "src/features/shop/scripts/tasks/lots-init.ts", local: false },
    { name: "wallet:lots-init", domain: "wallet", kind: "task", file: "src/features/core/wallet/scripts/tasks/lots-init.ts", local: false },
  ]);
});

test("lib.*・テスト・下のフォルダ・tasks の .local.ts・.ts 以外はタスクに数えない", () => {
  const root = tree({
    "src/features/core/wallet/scripts/tasks/lots-init.ts": taskBody("wallet:lots-init"),
    "src/features/core/wallet/scripts/tasks/lib.walletLotsSelection.ts": "export const x = 1;\n",
    "src/features/core/wallet/scripts/tasks/lots-init.test.ts": "\n",
    "src/features/core/wallet/scripts/tasks/parts/inner.ts": "\n",
    "src/features/core/wallet/scripts/tasks/README.md": "\n",
    "src/features/core/wallet/scripts/tasks/fix-rows.local.ts": "\n",
  });
  assert.deepEqual(listOneShotTasks(root).map((t) => t.name), ["wallet:lots-init"]);
});

test("git に入れない移行: migrations/<名前>.local.ts は local の移行 <ドメイン>:<名前>、notice を持たない。同じ名前の .ts と並ぶと止める", async () => {
  const root = tree({
    "src/features/core/wallet/scripts/migrations/fix-rows.local.ts": taskBody("wallet:fix-rows"),
    "src/features/core/wallet/scripts/migrations/with-notice.local.ts": 'export const task = { name: "wallet:with-notice", notice: "20261031-141531-setting-fields-core-ui", run: async () => ({}) };\n',
  });
  const files = listOneShotTasks(root);
  assert.deepEqual(files.map((f) => [f.name, f.kind, f.local]), [["wallet:fix-rows", "migration", true], ["wallet:with-notice", "migration", true]]);
  assert.equal((await loadOneShotTask(root, files[0])).name, "wallet:fix-rows");
  await assert.rejects(loadOneShotTask(root, files[1]), /git に入れない移行は notice: を持ちません/);
  const clash = tree({
    "src/features/shop/scripts/migrations/fix.ts": taskBody("shop:fix"),
    "src/features/shop/scripts/migrations/fix.local.ts": taskBody("shop:fix"),
  });
  assert.match(scanTasks(clash).problems.join("\n"), /タスク名 "shop:fix" が .*fix\.(local\.)?ts と .*fix\.(local\.)?ts/);
});

test("止まる置き方を全部並べる: 名前の形・同じ名前・古い置き場 scripts/tasks の残り", () => {
  const root = tree({
    "src/features/core/wallet/scripts/tasks/LotsInit.ts": "\n",
    "src/features/core/wallet/scripts/tasks/dup.ts": taskBody("wallet:dup"),
    "src/features/core/wallet/scripts/migrations/dup.ts": taskBody("wallet:dup"),
    "scripts/tasks/mine.ts": taskBody("mine"),
    "scripts/tasks/_shared/part.ts": "\n",
  });
  const { problems } = scanTasks(root);
  assert.equal(problems.length, 4, problems.join("\n"));
  assert.match(problems[0], /LotsInit\.ts: タスクのファイル名は <kebab-case の名前>\.ts/);
  assert.match(problems[1], /タスク名 "wallet:dup" が .*scripts\/tasks\/dup\.ts と .*scripts\/migrations\/dup\.ts/);
  assert.ok(problems.some((p) => /^scripts\/tasks\/mine\.ts: タスクの置き場 scripts\/tasks は無くなりました.*src\/features\/<ドメイン>\/scripts\/tasks/.test(p)));
  assert.ok(problems.some((p) => p.startsWith("scripts/tasks/_shared/part.ts:")));
  assert.throws(() => listOneShotTasks(root), /LotsInit[\s\S]*wallet:dup[\s\S]*scripts\/tasks\/mine\.ts/);
});

test("旧い fork の名前の印つきのファイル名は移し方を出す", () => {
  const root = tree({ "src/features/shop/scripts/tasks/fix.acme.ts": taskBody("shop:fix") });
  const { problems } = scanTasks(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /fix\.acme\.ts/);
});

test("読み込み: task.name が <ドメイン>:<ファイル名> と違えば止まり、合えば export const task を返す", async () => {
  const root = tree({
    "src/features/shop/scripts/tasks/good.ts": taskBody("shop:good"),
    "src/features/shop/scripts/tasks/bad.ts": taskBody("bad"),
  });
  const [bad, good] = listOneShotTasks(root);
  assert.equal((await loadOneShotTask(root, good)).name, "shop:good");
  await assert.rejects(loadOneShotTask(root, bad), /task\.name "bad" が "shop:bad"/);
});

test("移行は notice(notice の id)が必須、タスクは notice を持たない", async () => {
  const mig = (body: string) => `export const task = { name: "shop:fix", ${body} run: async () => ({}) };\n`;
  const root = tree({
    "src/features/shop/scripts/migrations/fix.ts": mig(""),
    "src/features/other/scripts/migrations/fix.ts": mig('notice: "20261031-141531-setting-fields-core-ui",').replace("shop:", "other:"),
    "src/features/third/scripts/tasks/fix.ts": mig('notice: "20261031-141531-setting-fields-core-ui",').replace("shop:", "third:"),
  });
  const byName = new Map(listOneShotTasks(root).map((f) => [f.name, f]));
  await assert.rejects(loadOneShotTask(root, byName.get("shop:fix")!), /移行は notice:/);
  assert.equal((await loadOneShotTask(root, byName.get("other:fix")!)).notice, "20261031-141531-setting-fields-core-ui");
  await assert.rejects(loadOneShotTask(root, byName.get("third:fix")!), /notice: は移行/);
});

test("taskNamesIn: 文の中の pnpm task の名前(旗・型は除く)", () => {
  const text = "run `pnpm task wallet:lots-init -- --all`, then pnpm task expire-pending-purchases; pnpm task --list; pnpm task <name>";
  assert.deepEqual(taskNamesIn(text), ["wallet:lots-init", "expire-pending-purchases"]);
});

test("taskNamesIn: 地の文の普通の単語は名前と読まない(lists・日本語)", () => {
  const text = "pnpm task lists the domain tasks. 名前は pnpm task が見つける。\nThe runner (pnpm task) reads them.";
  assert.deepEqual(taskNamesIn(text), []);
});

test("taskNamesIn: コードの中の名前は形を問わず拾う(インライン・塊・コマンドだけの行)", () => {
  const text = [
    "run `pnpm task wallet:nope` first, and `pnpm task cleanup` too",
    "```sh",
    "pnpm task sweep",
    "```",
    "pnpm task wallet:nope2 -- --dry-run",
    "- pnpm task listed",
    "1. $ pnpm task numbered",
    "pnpm task wallet:nope3 は無い名前",
  ].join("\n");
  assert.deepEqual(taskNamesIn(text), ["wallet:nope", "cleanup", "sweep", "wallet:nope2", "listed", "numbered", "wallet:nope3"]);
});

test("リポジトリの本物の木: 置き方の誤りが無く、全部のタスクが読み込めて名前が合う、定期タスクと名前が重ならない", async () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const tasks = listOneShotTasks(root);
  assert.ok(tasks.length >= 9, `タスクが ${tasks.length} 本しかない`);
  assert.ok(tasks.some((t) => t.kind === "migration"));
  const cron = cronTaskNames(root);
  for (const file of tasks) {
    assert.ok(!cron.includes(file.name), file.name);
    assert.equal((await loadOneShotTask(root, file)).name, file.name);
  }
});
