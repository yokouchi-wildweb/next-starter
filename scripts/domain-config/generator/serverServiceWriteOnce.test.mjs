// dc:generate の serverServices: <domain>Service.ts は書き捨て（無いときだけ生成）、drizzleBase.ts は毎回生成する回帰テスト。
// 実行: pnpm test:dc-server-service
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const generator = path.join(repoRoot, "scripts", "domain-config", "generator", "generate-server-service.mjs");
const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ジェネレーターは process.cwd() の src/features を見るので、テンプレートとドメインを一時ディレクトリに写して実行する
function makeProject(domains) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-server-service-"));
  tmpDirs.push(dir);
  fs.cpSync(path.join(repoRoot, "src", "features", "_template", "services"), path.join(dir, "src", "features", "_template", "services"), {
    recursive: true,
  });
  for (const domain of domains) {
    fs.mkdirSync(path.join(dir, "src", "features", domain), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, "src", "features", domain, "domain.json"), path.join(dir, "src", "features", domain, "domain.json"));
  }
  return dir;
}

function run(cwd, domain) {
  const result = spawnSync("node", [generator, domain], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

const serverDir = (root, domain) => path.join(root, "src", "features", domain, "services", "server");

test("<domain>Service.ts が無ければ drizzleBase.ts と一緒に生成する", () => {
  const root = makeProject(["sampleTag"]);
  run(root, "sampleTag");
  assert.ok(fs.existsSync(path.join(serverDir(root, "sampleTag"), "sampleTagService.ts")));
  assert.ok(fs.existsSync(path.join(serverDir(root, "sampleTag"), "drizzleBase.ts")));
});

test("既存の <domain>Service.ts は上書きせず、drizzleBase.ts は作り直す", () => {
  const root = makeProject(["sampleTag"]);
  run(root, "sampleTag");
  const servicePath = path.join(serverDir(root, "sampleTag"), "sampleTagService.ts");
  const basePath = path.join(serverDir(root, "sampleTag"), "drizzleBase.ts");
  const handEdited = `${fs.readFileSync(servicePath, "utf8")}// 手で足した独自処理\n`;
  fs.writeFileSync(servicePath, handEdited);
  const generatedBase = fs.readFileSync(basePath, "utf8");
  fs.writeFileSync(basePath, "// 古い drizzleBase\n");

  const result = run(root, "sampleTag");
  assert.equal(fs.readFileSync(servicePath, "utf8"), handEdited);
  assert.equal(fs.readFileSync(basePath, "utf8"), generatedBase);
  assert.match(result.stdout, /既存のため生成しません/);
});

test("mediaUploader があるのに既存の <domain>Service.ts が duplicate を組み込んでいなければ警告する", () => {
  const root = makeProject(["sample"]);
  const dir = serverDir(root, "sample");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "sampleService.ts"), 'import { base } from "./drizzleBase";\n\nexport const sampleService = { ...base };\n');
  const result = run(root, "sample");
  assert.match(result.stderr, /wrappers\/duplicate を組み込んでいません/);
  // duplicate ラッパー自体は毎回生成する
  assert.ok(fs.existsSync(path.join(dir, "wrappers", "duplicate.ts")));

  // 組み込み済みなら警告しない
  run(root, "sample");
  fs.writeFileSync(
    path.join(dir, "sampleService.ts"),
    'import { base } from "./drizzleBase";\nimport { duplicate } from "./wrappers/duplicate";\n\nexport const sampleService = { ...base, duplicate };\n',
  );
  assert.doesNotMatch(run(root, "sample").stderr, /組み込んでいません/);
});
