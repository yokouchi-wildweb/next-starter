// pnpm check domain -- --compare: fork がドメインごとに generate を true / false に決めるための 3 通りの比較（読み取りだけ）。
// 今のファイル ／ base（fork の merge-base）の生成器の出力 ／ 今の生成器の出力 を並べ、ファイルごとに分類する（classify.mjs）。
// 古い generateFiles のままの domain.json も読む（写しの中で「全部生成する」形に書き換える）。fork のリポには何も書かない

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createDomainContext } from "../../domain/context.mjs";
import { createWorkspace } from "../../domain/workspace.mjs";
import { classifyFile, summarizeDomain } from "./classify.mjs";
import { domainDirIn, extractGeneratorAt } from "./refGenerator.mjs";
import { printReport } from "./report.mjs";
import { buildTree, readIn, runDomains } from "./trees.mjs";

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** base = --base、無ければ upstream の remote の既定ブランチとの merge-base */
function resolveBase(repoRoot, explicit) {
  if (explicit) return git(repoRoot, ["rev-parse", "--verify", `${explicit}^{commit}`]);
  const remotes = git(repoRoot, ["remote"]).split("\n");
  if (!remotes.includes("upstream")) throw new Error("upstream の remote がありません。--base <取り込んだ上流の commit> を渡してください");
  const head = (() => {
    try {
      return git(repoRoot, ["symbolic-ref", "--short", "refs/remotes/upstream/HEAD"]);
    } catch {
      return "upstream/main";
    }
  })();
  return git(repoRoot, ["merge-base", "HEAD", head]);
}

/** そのファイルを最後に変えた fork の commit（手の変更か、上流の notice を当てたかを人が見分ける材料） */
const lastCommitOf = (repoRoot, rel) => {
  try {
    return git(repoRoot, ["log", "-1", "--format=%h %s", "--", rel]) || null;
  } catch {
    return null;
  }
};

/** ドメイン → そのドメインのファイルの置き場（ドメインのフォルダと管理画面のルート） */
function ownerOf(workspace, domains) {
  const roots = domains.map((name) => {
    const ctx = createDomainContext(workspace, name);
    return { name, prefixes: [`${ctx.rel}/`, `src/app/admin/(protected)/${ctx.kebabPlural}/`] };
  });
  return (rel) => roots.find((r) => r.prefixes.some((p) => rel.startsWith(p)))?.name ?? null;
}

const listFiles = (dir, base = dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, d.name);
    if (d.isDirectory()) listFiles(abs, base, out);
    else out.push(path.relative(base, abs).split(path.sep).join("/"));
  }
  return out;
};

/** @param {string[]} argv getCliArgs の結果 */
export async function runCompare(argv, { repoRoot = process.cwd(), io = console } = {}) {
  const value = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null : argv[i + 1];
  };
  const named = argv.filter((a, i) => !a.startsWith("--") && !["--base", "--json"].includes(argv[i - 1]));
  const base = resolveBase(repoRoot, value("base"));
  const detail = argv.includes("--detail");
  const workspace = createWorkspace(repoRoot);
  const all = workspace.listDomains().filter((name) => workspace.locateDomain(name).kind === "business");
  const domains = named.length ? all.filter((name) => named.includes(name)) : all;
  if (named.length && domains.length !== named.length) throw new Error(`domain.json の無いドメイン: ${named.filter((n) => !all.includes(n)).join(", ")}`);
  const configs = all.map((name) => ({ name, configPath: workspace.configPath(name) }));

  const ref = extractGeneratorAt(repoRoot, base, "dc-compare-ref-");
  const { GENERATE_CATEGORIES } = await import(pathToFileURL(path.join(ref.scripts, domainDirIn(ref.scripts), "spec", "categories.mjs")).href);
  const categories = GENERATE_CATEGORIES ?? [];
  const trees = [];
  try {
    const baseTree = buildTree({ repoRoot, scriptsDir: ref.scripts, partsRoot: ref.root, parts: ref.parts, domains: configs, categories, prefix: "dc-compare-base-" });
    const nowTree = buildTree({ repoRoot, scriptsDir: path.join(repoRoot, "scripts"), domains: configs, categories, prefix: "dc-compare-now-" });
    trees.push(baseTree.root, nowTree.root);
    const baseRun = runDomains(baseTree.root, domains);
    const nowRun = runDomains(nowTree.root, domains);

    const owner = ownerOf(workspace, all);
    const byDomain = new Map(domains.map((name) => [name, []]));
    for (const rel of new Set([...baseRun.actions.keys(), ...nowRun.actions.keys()])) {
      const name = owner(rel);
      if (!byDomain.has(name)) continue;
      const file = {
        path: rel,
        current: readIn(repoRoot, rel),
        base: readIn(baseTree.root, rel),
        now: readIn(nowTree.root, rel),
        baseListed: baseRun.actions.has(rel),
        nowListed: nowRun.actions.has(rel),
        nowAction: nowRun.actions.get(rel),
      };
      const result = classifyFile(file);
      const lastCommit = detail && (result.kind === "hand" || result.kind === "stale") ? lastCommitOf(repoRoot, rel) : null;
      byDomain.get(name).push({ path: rel, result, ...(lastCommit ? { lastCommit } : {}) });
    }
    const results = domains.map((name) => {
      const listed = new Set([...baseRun.actions.keys(), ...nowRun.actions.keys()]);
      const dir = workspace.locateDomain(name).rel;
      const own = listFiles(path.join(repoRoot, dir)).map((f) => `${dir}/${f}`).filter((f) => !listed.has(f) && !f.endsWith("/domain.json"));
      const files = byDomain.get(name).sort((a, b) => a.path.localeCompare(b.path));
      return {
        name,
        files,
        forkFiles: own.filter((f) => !f.includes("/wrappers/")),
        wrapperFiles: own.filter((f) => f.includes("/wrappers/")),
        summary: summarizeDomain({ files, forkFiles: own.filter((f) => !f.includes("/wrappers/")), wrapperFiles: own.filter((f) => f.includes("/wrappers/")), nowError: nowRun.errors.get(name), baseError: baseRun.errors.get(name) }),
      };
    });
    const subject = git(repoRoot, ["log", "-1", "--format=%h %s", base]);
    printReport({ base: subject, legacy: baseTree.legacy, results, detail }, io);
    const json = value("json");
    if (json) fs.writeFileSync(path.resolve(repoRoot, json), `${JSON.stringify({ base, results: results.map(({ name, summary, files, forkFiles, wrapperFiles }) => ({ name, summary, files, forkFiles, wrapperFiles })) }, null, 2)}\n`);
    return results;
  } finally {
    if (!argv.includes("--keep")) for (const dir of [ref.root, ...trees]) fs.rmSync(dir, { recursive: true, force: true });
    else io.log(`作業ツリー: ${[ref.root, ...trees].join(" ")}`);
  }
}
