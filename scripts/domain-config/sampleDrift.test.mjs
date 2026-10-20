// サンプルドメイン（sample / sampleCategory / sampleTag）の生成物が現在のテンプレート・生成器と一致するかを検査する。
// テンプレートや生成器を変えたのにサンプルを再生成し忘れると落ちる（fork が手本にするサンプルの陳腐化防止）。
// 作業ツリーを上書きしないよう、src/ と scripts/domain-config/ を一時ディレクトリへ複製して生成・比較する。
// 対象ドメインが存在しなければスキップする（サンプルを削除した fork では何もしない）。
// 実行: pnpm test:dc-sample-drift
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SAMPLE_DOMAINS = ["sample", "sampleCategory", "sampleTag"];

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function listFiles(dir, base = dir) {
  const result = [];
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, dirent.name);
    if (dirent.isDirectory()) result.push(...listFiles(abs, base));
    else if (dirent.isFile()) result.push(path.relative(base, abs));
  }
  return result;
}

const targets = SAMPLE_DOMAINS.filter((d) => fs.existsSync(path.join(rootDir, "src", "features", d, "domain.json")));

test("サンプルドメインを再生成しても差分が出ない", { skip: targets.length === 0 && "サンプルドメインが無い" }, (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dc-sample-drift-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  fs.cpSync(path.join(rootDir, "src"), path.join(tempRoot, "src"), { recursive: true });
  fs.cpSync(path.join(rootDir, "scripts", "domain-config"), path.join(tempRoot, "scripts", "domain-config"), {
    recursive: true,
  });
  fs.symlinkSync(path.join(rootDir, "node_modules"), path.join(tempRoot, "node_modules"), "dir");

  for (const domain of targets) {
    const result = spawnSync(
      "node",
      [path.join(tempRoot, "scripts", "domain-config", "index.mjs"), "--generate", domain, "--yes"],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${domain} の生成に失敗しました:\n${result.stdout}\n${result.stderr}`);
  }

  const drifted = listFiles(path.join(tempRoot, "src")).filter((rel) => {
    const original = path.join(rootDir, "src", rel);
    if (!fs.existsSync(original)) return true;
    return !fs.readFileSync(original).equals(fs.readFileSync(path.join(tempRoot, "src", rel)));
  });

  assert.deepEqual(
    drifted,
    [],
    `生成物がテンプレートと食い違っています。\`pnpm dc:generate <Domain> --yes\` で再生成してコミットしてください（対象: ${targets.join(", ")}）`,
  );
});
