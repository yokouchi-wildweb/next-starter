// git ref の時点の生成器を一時ディレクトリに組み立てる（pnpm test scripts/structure/domain/tests の旧側・pnpm check domain -- --compare の base 側で共有）。
// 生成器 = scripts/structure/domain と scripts/structure/registry。生成器は src の .mjs（型の表 src/lib/domain/fields、src/utils など）も
// import するので、ref の生成器の相対 import を辿り切って、それらのフォルダも ref から取り出す（ref に無いフォルダは missing）。
// テンプレート（src/features/_template・src/app/admin/_template）も生成器の一部として ref から取り出す（parts に入る）。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const GENERATOR_DIRS = ["scripts/structure/domain", "scripts/structure/registry"];
/** 旧い版での生成器の置き場(scripts/ の再編の前)。ref に今の置き場が無ければこちらを取り出す */
export const LEGACY_GENERATOR_DIRS = { "scripts/structure/domain": "scripts/domain-config", "scripts/structure/registry": "scripts/registry" };

/** scripts/ の中で、その版の生成器 dir(GENERATOR_DIRS の 1 つ)が置かれている所(scripts/ からの相対)。無ければ null */
export function generatorDirIn(scriptsDir, dir) {
  return [dir, LEGACY_GENERATOR_DIRS[dir]].filter(Boolean).map((d) => d.replace(/^scripts\//, "")).find((r) => fs.existsSync(path.join(scriptsDir, r))) ?? null;
}

/** その版のドメインの生成器の置き場(scripts/ からの相対) */
export const domainDirIn = (scriptsDir) => generatorDirIn(scriptsDir, "scripts/structure/domain");
export const TEMPLATE_DIRS = ["src/features/_template", "src/app/admin/_template"];
const RELATIVE_IMPORT = /from\s+["']((?:\.\.?\/)+[^"']+)["']/g;

/** 生成器が src の外で相対 import してよい所(登録表の検査が指定子を解く部品 eslint-rules/resolve-import.mjs) */
const OUTSIDE_SRC_IMPORT_DIRS = ["eslint-rules"];

/** dir 以下の .mjs（tests/ と *.test.mjs を除く）が相対 import する、root/src 配下のフォルダと eslint-rules（root 相対） */
export function srcImportDirs(root, dir) {
  const out = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "tests" && e.name !== "node_modules") walk(abs);
      } else if (e.name.endsWith(".mjs") && !e.name.endsWith(".test.mjs")) {
        for (const m of fs.readFileSync(abs, "utf8").matchAll(RELATIVE_IMPORT)) {
          const rel = path.relative(root, path.resolve(path.dirname(abs), m[1]));
          if (rel.startsWith(`src${path.sep}`) || OUTSIDE_SRC_IMPORT_DIRS.some((d) => rel.startsWith(`${d}${path.sep}`))) out.add(path.dirname(rel));
        }
      }
    }
  };
  walk(dir);
  return out;
}

/** リポジトリの今の生成器が import する src のフォルダ（比べないフォルダの判定に使う） */
export const generatorImportDirs = (repoRoot) =>
  [...new Set([...TEMPLATE_DIRS, ...GENERATOR_DIRS.flatMap((p) => [...srcImportDirs(repoRoot, path.join(repoRoot, p))])])].sort();

/**
 * <ref> の生成器と、それが import する src のフォルダを取り出す
 * @param {string} repoRoot git のリポジトリ
 * @param {string} ref
 * @param {string} [prefix] 一時ディレクトリの名前の頭
 * @returns {{ root: string, scripts: string, parts: string[], missing: string[] }} root = 一時ディレクトリ（使い終わったら消す）
 */
export function extractGeneratorAt(repoRoot, ref, prefix = "dc-ref-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const archive = (paths) =>
    execFileSync("sh", ["-c", `git archive ${JSON.stringify(ref)} ${paths.map((p) => JSON.stringify(p)).join(" ")} | tar -x -C ${JSON.stringify(root)}`], { cwd: repoRoot });
  const inRef = (p) => execFileSync("git", ["ls-tree", ref, "--", p], { cwd: repoRoot, encoding: "utf8" }).trim() !== "";
  const generatorDirs = GENERATOR_DIRS.map((d) => (inRef(d) || !LEGACY_GENERATOR_DIRS[d] ? d : LEGACY_GENERATOR_DIRS[d]));
  archive(generatorDirs);
  const parts = new Set();
  const missing = new Set();
  const templates = TEMPLATE_DIRS.filter(inRef);
  if (templates.length) archive(templates);
  for (const dir of TEMPLATE_DIRS) (templates.includes(dir) ? parts : missing).add(dir);
  let pending = generatorDirs;
  while (pending.length) {
    const found = new Set(pending.flatMap((p) => [...srcImportDirs(root, path.join(root, p))]));
    const fresh = [...found].filter((d) => !parts.has(d) && !missing.has(d));
    const present = fresh.filter(inRef);
    for (const d of fresh) (present.includes(d) ? parts : missing).add(d);
    if (present.length) archive(present);
    pending = present;
  }
  return { root, scripts: path.join(root, "scripts"), parts: [...parts].sort(), missing: [...missing].sort() };
}
