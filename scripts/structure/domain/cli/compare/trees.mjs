// pnpm check domain -- --compare の作業ツリー: fork の src の写しに片方の生成器を載せ、domain.json を「全部生成する」形に書き換えて、
// ドメインを 1 つずつ --dry-run（生成器が扱うパスと動作）→ 生成（中身）の順に回す。書くのは一時ディレクトリだけ（fork のリポには書かない）

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { GENERATOR_DIRS, domainDirIn, generatorDirIn } from "./refGenerator.mjs";

const cp = (src, dest) => fs.cpSync(src, dest, { recursive: true, dereference: false });
const DRY_RUN_LINE = /^\s*\[dry-run\]\s+(\S+)\s+(.+)$/;
const CHILD_ONLY_FALSE = new Set(["adminRoutes", "clientServices", "components", "hooks"]);

/** base の生成器が generateFiles を廃止済みか（廃止後は generate の旗で読む） */
const retiredGenerateFiles = (scriptsDir) => {
  const file = path.join(scriptsDir, domainDirIn(scriptsDir) ?? "domain-config", "checks", "required.mjs");
  return fs.existsSync(file) && fs.readFileSync(file, "utf8").includes("generateFiles は廃止");
};

/**
 * 「この生成器でこのドメインを全部生成したら」の domain.json（写しの中だけで使う）
 * @param {object} config fork の今の domain.json
 * @param {{ legacy: boolean, categories: string[] }} side legacy = generateFiles で読む生成器
 */
export function generateAllConfig(config, { legacy, categories }) {
  const next = { ...config };
  const falses = Object.entries(config.generateFiles ?? {}).filter(([, on]) => on === false).map(([k]) => k);
  const child = falses.length > 0 && falses.every((k) => CHILD_ONLY_FALSE.has(k));
  delete next.generate;
  delete next.generateFiles;
  if (legacy) next.generateFiles = child ? config.generateFiles : Object.fromEntries(categories.map((c) => [c, true]));
  return next;
}

/**
 * 片方の作業ツリーを作る
 * @param {{ repoRoot: string, scriptsDir: string, partsRoot?: string, parts?: string[], domains: { name: string, configPath: string }[], categories: string[], prefix: string }} options
 *   scriptsDir = 載せる生成器（scripts/）、parts = partsRoot から重ねる src のフォルダ（base 側）
 */
export function buildTree({ repoRoot, scriptsDir, partsRoot, parts = [], domains, categories, prefix }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cp(path.join(repoRoot, "src"), path.join(root, "src"));
  // 生成器の置き場は版で違う(scripts/registry → scripts/structure/registry)。載せる側の版にある方を、その版の並びのまま写す
  for (const dir of GENERATOR_DIRS) {
    const rel = generatorDirIn(scriptsDir, dir);
    if (rel) cp(path.join(scriptsDir, rel), path.join(root, "scripts", rel));
  }
  for (const part of parts) {
    fs.rmSync(path.join(root, part), { recursive: true, force: true });
    cp(path.join(partsRoot, part), path.join(root, part));
  }
  const nodeModules = path.join(repoRoot, "node_modules");
  if (fs.existsSync(nodeModules)) fs.symlinkSync(nodeModules, path.join(root, "node_modules"), "dir");
  const legacy = !retiredGenerateFiles(scriptsDir);
  for (const { configPath } of domains) {
    const target = path.join(root, path.relative(repoRoot, configPath));
    const config = JSON.parse(fs.readFileSync(target, "utf8"));
    fs.writeFileSync(target, `${JSON.stringify(generateAllConfig(config, { legacy, categories }), null, 2)}\n`);
  }
  return { root, legacy };
}

function run(root, args) {
  const r = spawnSync("node", [path.join(root, "scripts", domainDirIn(path.join(root, "scripts")), "index.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  return { status: r.status, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** 止まったときの文（生成器の出力の要点だけ。止めない警告 [domain.json] … は外す） */
function errorText(output, root) {
  const lines = output.split(root).join("<ROOT>").split("\n").filter((line) => line.trim() && !line.includes("[dry-run]"));
  const stops = lines.filter((line) => !line.startsWith("[domain.json]"));
  return (stops.length ? stops : lines).slice(-4).join(" / ");
}

/**
 * ドメインを 1 つずつ回す
 * @returns {{ actions: Map<string, string>, errors: Map<string, string> }} actions = リポジトリ相対のパス → 動作（後の実行が勝つ）
 */
export function runDomains(root, domainNames) {
  const actions = new Map();
  const errors = new Map();
  for (const domain of domainNames) {
    const dry = run(root, ["--generate", domain, "--yes", "--dry-run"]);
    for (const line of dry.output.split("\n")) {
      const m = line.match(DRY_RUN_LINE);
      if (m) actions.set(m[2].trim().split(path.sep).join("/"), m[1]);
    }
    if (dry.status !== 0) {
      errors.set(domain, errorText(dry.output, root));
      continue;
    }
    const gen = run(root, ["--generate", domain, "--yes"]);
    if (gen.status !== 0) errors.set(domain, errorText(gen.output, root));
  }
  return { actions, errors };
}

/** 作業ツリーのファイル（無ければ null） */
export const readIn = (root, rel) => {
  const file = path.join(root, rel);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, "utf8") : null;
};
