// scripts/workflow/notices/whenExports.mjs
// pnpm workflow notices whenExports [--base=<ref>] [--json]: 門番の規則の when が指せる値(ドメインの config.ts の最上位の export const <名前>: boolean、D28)のうち、
// 基準(既定 = push 先 @{u}、無ければ origin/HEAD)にあって HEAD に無い物(消えた・改名・真偽でなくなった)を出す。/sluice step 3 が読み、出たら notice に旧 → 新の表を書く
// (fork の規則の when が指していれば fork の生成で止まるので、required_actions に直し方を書く)。0 件なら何も出さない(exit 0)。
// 同じ config.ts に HEAD で増えた真偽の export は改名の候補として並べる。上流の規則(基準の木)が指していた名前には印を付ける

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { booleanExportsOf, readWhen } from "../../structure/extensions/derive/gateWhen.mjs";

const CONFIG_PATH = /^src\/domains\/(?:core\/)?([^/_][^/]*)\/config\.ts$/;
const RULE_PATH = /^src\/featureGate\/rules\/[^/]+\.ts$/;

const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const tryGit = (repo, args) => {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
};

/** 既定の基準: @{u}、無ければ origin/HEAD(どちらも無ければ null) */
export function defaultBase(repo) {
  for (const ref of ["@{u}", "origin/HEAD"]) if (tryGit(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`])) return ref;
  return null;
}

/**
 * 1 つの木(ref)のドメインの config.ts の真偽の export と、規則の when が指す値
 * @param {(path: string) => string | null} readText
 * @param {string[]} files 木のファイル(リポジトリ直下からの相対)
 */
export function whenSurfaceOf(files, readText) {
  /** @type {Map<string, { path: string, booleans: Set<string> }>} ドメインの名前 → config.ts */
  const configs = new Map();
  for (const path of files) {
    const match = CONFIG_PATH.exec(path);
    if (!match) continue;
    const text = readText(path);
    if (text !== null) configs.set(match[1], { path, booleans: booleanExportsOf(path, text).booleans });
  }
  /** @type {Map<string, string[]>} "<ドメイン>.<名前>" → 指す規則のファイル */
  const pointed = new Map();
  for (const path of files.filter((f) => RULE_PATH.test(f))) {
    const read = readWhen(readText(path) ?? "");
    if ("problem" in read) continue;
    for (const ref of read.when) pointed.set(ref, [...(pointed.get(ref) ?? []), path]);
  }
  return { configs, pointed };
}

/**
 * 基準にあって HEAD に無い真偽の export(純関数)
 * @param {ReturnType<typeof whenSurfaceOf>} base
 * @param {ReturnType<typeof whenSurfaceOf>} head
 * @returns {{ ref: string, config: string, candidates: string[], pointedBy: string[] }[]}
 */
export function goneWhenExports(base, head) {
  const gone = [];
  for (const [domain, before] of base.configs) {
    const after = head.configs.get(domain);
    const added = after ? [...after.booleans].filter((name) => !before.booleans.has(name)).sort() : [];
    for (const name of [...before.booleans].sort()) {
      if (after?.booleans.has(name)) continue;
      const ref = `${domain}.${name}`;
      gone.push({ ref, config: before.path, candidates: added.map((n) => `${domain}.${n}`), pointedBy: base.pointed.get(ref) ?? [] });
    }
  }
  return gone;
}

/** 木を読む口(ref の木) */
function treeReader(repo, ref) {
  const files = git(repo, ["ls-tree", "-r", "-z", "--name-only", ref, "--", "src/domains", "src/featureGate/rules"]).split("\0").filter(Boolean);
  return { files, readText: (path) => tryGit(repo, ["show", `${ref}:${path}`]) };
}

function main() {
  const args = process.argv.slice(2);
  const repo = process.cwd();
  const base = args.find((a) => a.startsWith("--base="))?.slice("--base=".length) ?? defaultBase(repo);
  if (!base) {
    console.log("whenExports: 基準が分からない(@{u} も origin/HEAD も無い。--base=<ref>)");
    process.exit(2);
  }
  const before = treeReader(repo, base);
  const after = treeReader(repo, "HEAD");
  const gone = goneWhenExports(whenSurfaceOf(before.files, before.readText), whenSurfaceOf(after.files, after.readText));
  if (args.includes("--json")) {
    console.log(JSON.stringify({ base, gone }, null, 2));
    return;
  }
  if (gone.length === 0) return;
  console.log(`whenExports: 規則の when が指せる値が ${base}..HEAD で ${gone.length} 個消えた(notice に旧 → 新の表、fork の規則の when の直し方を required_actions に)`);
  for (const g of gone) {
    const candidates = g.candidates.length > 0 ? ` → 候補 ${g.candidates.join(" / ")}` : " → 新しい名前なし(削除)";
    const pointed = g.pointedBy.length > 0 ? `  [上流の規則が指していた: ${g.pointedBy.join("・")}]` : "";
    console.log(`  ${g.ref}(${g.config})${candidates}${pointed}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
