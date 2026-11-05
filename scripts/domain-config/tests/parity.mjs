#!/usr/bin/env node
// 生成器の前後比較（パリティ）: 指定した git ref の生成器と、作業ツリーの生成器を同じ fixture に流し、
// src/ 配下の生成物・終了コード・標準出力/エラー（行の集合）を突き合わせる。生成器を触ったら必ず回す。
//
// 使い方（リポジトリのルートで）:
//   pnpm dc:parity <git-ref>                              サンプル + 合成 fixture（成功系・失敗系）
//   pnpm dc:parity <git-ref> --repo ../oripa-do            fork の domain.json 一式も fixture にする（複数可）
//   pnpm dc:parity <git-ref> --fixtures samples,synthetic --modes each,all --variants fresh --keep
//
// fixture: samples = このリポの src/ をそのまま | synthetic / synthetic-bad = tests/fixtures/parity/<name>/<domain>/domain.json を
//   src/features に重ねる | --repo = そのリポの src/features/*/domain.json を重ねる（fresh = domain.json だけ、existing = ドメインフォルダ・
//   管理画面ルート・registry も写す = write-once や「既に登録済み」の経路を通す）
// mode: each = 1 ドメインずつ --yes | all = --all --yes | all2 = all を 2 回（冪等性）| only-registry | only-entities-hooks
// 失敗系 fixture では両版が同じ exit code・同じエラー文で止まることを見る。意図して変えた挙動は差分として出るので目で確かめる。
// 旧側の src 部品: 生成器は src の .mjs（型の表 src/lib/domain/fields、src/utils など）も import するので、旧側はそれらのフォルダも
//   ref から取り出して重ねる（ref の生成器の import を辿って決める。ref に無いフォルダは作業ツリーのまま = 起動時にそう出す）。
//   重ねたフォルダは生成物ではないので比べない（新側が import するフォルダも同じく外す）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractGeneratorAt, generatorImportDirs } from "../cli/compare/refGenerator.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const fixtureRoot = path.join(here, "fixtures", "parity");
const SKIP_DIRS = new Set(["core", "_template"]);
const REGISTRY_FILES = ["schemaRegistry.ts", "domainConfigRegistry.ts", "adminDataMenu.ts", "storagePurposeRegistry.ts", "serviceRegistry.ts"];

const args = process.argv.slice(2).filter((a) => a !== "--");
const ref = args.find((a) => !a.startsWith("--"));
const option = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
if (!ref) {
  console.error("使い方: pnpm dc:parity <git-ref> [--repo <path>]... [--fixtures samples,synthetic,synthetic-bad] [--modes each,all,all2,only-registry,only-entities-hooks] [--variants fresh,existing] [--keep]");
  process.exit(1);
}
const repos = args.flatMap((a, i) => (a === "--repo" ? [args[i + 1]] : a.startsWith("--repo=") ? [a.slice(7)] : []));
const fixtures = option("fixtures", "samples,synthetic,synthetic-bad").split(",");
const modes = option("modes", "each,all,all2,only-registry,only-entities-hooks").split(",");
const variants = option("variants", "fresh,existing").split(",");
const keep = args.includes("--keep");

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const cp = (src, dest) => fs.cpSync(src, dest, { recursive: true, dereference: false });

/** <ref> の生成器と、それが import する src のフォルダ（cli/compare/refGenerator.mjs。dc:compare と共有） */
const extractOld = () => extractGeneratorAt(repoRoot, ref, "dc-parity-old-");

/** domain.json を持つドメインフォルダ（features ディレクトリ直下） */
function listDomains(featuresDir) {
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name) && fs.existsSync(path.join(featuresDir, d.name, "domain.json")))
    .map((d) => d.name)
    .sort();
}

/** fixture の「元」: features ディレクトリ（domain.json の置き場）と、existing で写すリポのルート */
function resolveFixture(name) {
  if (name === "samples") return { label: "samples", featuresDir: null, repo: null };
  const synthetic = path.join(fixtureRoot, name);
  if (fs.existsSync(synthetic)) return { label: name, featuresDir: synthetic, repo: null };
  const repo = path.resolve(name);
  if (fs.existsSync(path.join(repo, "src", "features"))) return { label: path.basename(repo), featuresDir: path.join(repo, "src", "features"), repo };
  throw new Error(`fixture が見つかりません: ${name}`);
}

/** このリポの src/ を複製し、fixture のドメインを重ねた基準ツリーを作る */
function buildBase({ featuresDir, repo }, variant) {
  const base = tmp("dc-parity-base-");
  cp(path.join(repoRoot, "src"), path.join(base, "src"));
  if (!featuresDir) return base;
  for (const d of listDomains(featuresDir)) {
    const dest = path.join(base, "src", "features", d);
    fs.rmSync(dest, { recursive: true, force: true });
    if (variant === "existing" && repo) {
      cp(path.join(featuresDir, d), dest);
    } else {
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(path.join(featuresDir, d, "domain.json"), path.join(dest, "domain.json"));
    }
  }
  if (variant === "existing" && repo) {
    const adminSrc = path.join(repo, "src", "app", "admin", "(protected)");
    const adminDest = path.join(base, "src", "app", "admin", "(protected)");
    for (const d of fs.existsSync(adminSrc) ? fs.readdirSync(adminSrc, { withFileTypes: true }) : []) {
      if (d.isDirectory() && !fs.existsSync(path.join(adminDest, d.name))) cp(path.join(adminSrc, d.name), path.join(adminDest, d.name));
    }
    for (const f of REGISTRY_FILES) {
      const src = path.join(repo, "src", "registry", f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(base, "src", "registry", f));
    }
  }
  return base;
}

/** 基準ツリー + 片方の生成器（旧側は ref の src 部品も重ねる）で作業ツリーを作る */
function makeWork(base, side) {
  const work = tmp("dc-parity-work-");
  cp(path.join(base, "src"), path.join(work, "src"));
  cp(path.join(side.scripts, "domain-config"), path.join(work, "scripts", "domain-config"));
  // 登録表の生成器の置き場は版で違う(scripts/registry → scripts/structure/registry)。その版の並びのまま写す
  const registryDir = ["structure/registry", "registry"].find((r) => fs.existsSync(path.join(side.scripts, r)));
  cp(path.join(side.scripts, registryDir), path.join(work, "scripts", registryDir));
  for (const part of side.parts) {
    fs.rmSync(path.join(work, part), { recursive: true, force: true });
    cp(path.join(side.root, part), path.join(work, part));
  }
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(work, "node_modules"), "dir");
  return work;
}

function exec(work, cliArgs) {
  const r = spawnSync("node", [path.join(work, "scripts", "domain-config", "index.mjs"), ...cliArgs], {
    cwd: work,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const norm = (s) => (s ?? "").split(work).join("<ROOT>").split("\n").filter(Boolean).sort().join("\n");
  return { status: r.status, stdout: norm(r.stdout), stderr: norm(r.stderr) };
}

const MODE_COMMANDS = {
  each: (domains) => domains.map((d) => [`generate ${d}`, ["--generate", d, "--yes"]]),
  all: () => [["all", ["--generate", "--all", "--yes"]]],
  all2: () => [["all#1", ["--generate", "--all", "--yes"]], ["all#2", ["--generate", "--all", "--yes"]]],
  "only-registry": () => [["all --only registry", ["--generate", "--all", "--yes", "--only", "registry"]]],
  "only-entities-hooks": () => [["all --only entities,hooks", ["--generate", "--all", "--yes", "--only=entities,hooks"]]],
};

function runMode(work, mode, domains) {
  const commands = MODE_COMMANDS[mode];
  if (!commands) throw new Error(`不明な mode: ${mode}（${Object.keys(MODE_COMMANDS).join(", ")}）`);
  return commands(domains).map(([cmd, cliArgs]) => ({ cmd, ...exec(work, cliArgs) }));
}

function listFiles(dir, base = dir, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, d.name);
    if (d.isSymbolicLink()) continue;
    if (d.isDirectory()) listFiles(abs, base, out);
    else out.push(path.relative(base, abs));
  }
  return out;
}

function compare(workOld, workNew, runsOld, runsNew, excluded) {
  const problems = [];
  for (let i = 0; i < Math.max(runsOld.length, runsNew.length); i++) {
    const x = runsOld[i];
    const y = runsNew[i];
    if (!x || !y) {
      problems.push("run count differs");
      break;
    }
    if (x.status !== y.status) problems.push(`[${x.cmd}] exit old=${x.status} new=${y.status}`);
    if (x.stdout !== y.stdout) problems.push(`[${x.cmd}] stdout differs`);
    if (x.stderr !== y.stderr) problems.push(`[${x.cmd}] stderr differs`);
  }
  const generated = (f) => !excluded.some((part) => path.join("src", f).startsWith(`${part}${path.sep}`));
  const filesOld = new Set(listFiles(path.join(workOld, "src")).filter(generated));
  const filesNew = new Set(listFiles(path.join(workNew, "src")).filter(generated));
  for (const f of filesOld) if (!filesNew.has(f)) problems.push(`only in old: ${f}`);
  for (const f of filesNew) if (!filesOld.has(f)) problems.push(`only in new: ${f}`);
  for (const f of filesOld) {
    if (filesNew.has(f) && !fs.readFileSync(path.join(workOld, "src", f)).equals(fs.readFileSync(path.join(workNew, "src", f)))) problems.push(`differs: ${f}`);
  }
  return problems;
}

const oldSide = extractOld();
const newSide = { root: repoRoot, scripts: path.join(repoRoot, "scripts"), parts: [] };
const newParts = generatorImportDirs(repoRoot);
const excluded = [...new Set([...oldSide.parts, ...newParts])].sort();
console.log(`旧側の src 部品（${ref} から重ねる）: ${oldSide.parts.join("・") || "なし"}`);
if (oldSide.missing.length) console.log(`  ${ref} に無いので作業ツリーの src を使う: ${oldSide.missing.join("・")}`);
console.log(`比べないフォルダ（生成物でない src 部品）: ${excluded.join("・") || "なし"}\n`);
const reportDir = tmp("dc-parity-report-");
let cases = 0;
let failures = 0;
for (const name of [...fixtures, ...repos]) {
  const fixture = resolveFixture(name);
  const domains = listDomains(fixture.featuresDir ?? path.join(repoRoot, "src", "features"));
  for (const variant of variants) {
    if (variant === "existing" && !fixture.repo) continue;
    const base = buildBase(fixture, variant);
    for (const mode of modes) {
      cases++;
      const workOld = makeWork(base, oldSide);
      const workNew = makeWork(base, newSide);
      const runsOld = runMode(workOld, mode, domains);
      const runsNew = runMode(workNew, mode, domains);
      const problems = compare(workOld, workNew, runsOld, runsNew, excluded);
      const label = `${fixture.label} / ${variant} / ${mode}`;
      if (problems.length === 0) {
        console.log(`ok   ${label}  (exit ${runsOld.map((r) => r.status).join(",")})`);
      } else {
        failures++;
        console.log(`FAIL ${label}`);
        for (const p of problems.slice(0, 30)) console.log(`     ${p}`);
        const report = path.join(reportDir, `${fixture.label}-${variant}-${mode}.json`);
        fs.writeFileSync(report, JSON.stringify({ old: runsOld, new: runsNew, problems }, null, 2));
        console.log(`     report: ${report}${keep ? `\n     old=${workOld}\n     new=${workNew}` : ""}`);
      }
      if (!keep) {
        fs.rmSync(workOld, { recursive: true, force: true });
        fs.rmSync(workNew, { recursive: true, force: true });
      }
    }
    if (!keep) fs.rmSync(base, { recursive: true, force: true });
  }
}
fs.rmSync(oldSide.root, { recursive: true, force: true });
console.log(`\n${cases - failures}/${cases} cases match（旧 = ${ref}、新 = 作業ツリー）`);
process.exit(failures ? 1 : 0);
