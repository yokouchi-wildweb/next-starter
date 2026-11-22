// scripts/workflow/rules/lib.ruleRepo.mjs
// pnpm check rules の検査(size.mjs・format.mjs)が共有する、リポの読み手: 決まりのファイルの一覧・上流の物の見分け・品目の一覧。
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { readBaseFiles, CATALOG_FILE, catalogSectionNames, readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";

export const CORE_DIR = ".claude/rules/core";
export const ITEMS_DIR = ".claude/rules/items";
export const SERVICE_DIR = ".claude/rules/service";
export const CARD_CATEGORIES = ["lib", "features", "components"];

/** dir の下の .md(リポ直下からのパス、並べ替え済み) */
export function mdUnder(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".md"))
    .map((f) => relative(root, join(abs, f)))
    .sort();
}

/**
 * 上流の物の見分け: Tier1 では全部、fork では基準の版(台帳の最後の upstream:<sha>)にある物
 * @returns {{ isTier1: boolean, upstreamOf: (path: string) => boolean, note: string | null }}
 */
export function upstreamReader(root) {
  const identity = readForkIdentity(root);
  if (identity.isTier1) return { isTier1: true, upstreamOf: () => true, note: null };
  const base = readBaseFiles(root);
  if ("problem" in base) return { isTier1: false, upstreamOf: () => true, note: `上流の札の見分けが付かない(${base.problem})→ 札は全部を上流として扱った` };
  const files = new Set(base.files);
  return { isTier1: false, upstreamOf: (path) => files.has(path), note: null };
}

const dirsIn = (root, dir) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir))
        .filter((n) => !n.startsWith("_") && !n.startsWith(".") && statSync(join(root, dir, n)).isDirectory())
        .sort()
    : [];

/**
 * 品目の一覧(札の対象の候補): lib = src/lib/CATALOG.md の行、features = src/domains/core/* と業務の src/domains/*、components = src/components/<Category>/
 * tier1 = Tier1 の品目(lib は CATALOG.md の先頭の節、features は core のドメイン、components は全部)
 * @returns {{ category: string, name: string, folder: string, tier1: boolean, hasReadme: boolean }[]}
 */
export function listItems(root) {
  const items = [];
  const catalogPath = join(root, CATALOG_FILE);
  if (existsSync(catalogPath)) {
    const text = readFileSync(catalogPath, "utf8");
    const first = catalogSectionNames(text)[0];
    let section = null;
    for (const line of text.split("\n")) {
      const h = line.match(/^## (\S+)/);
      if (h) section = h[1];
      const m = line.match(/^- src\/lib\/([\w-]+)/);
      if (m && section) items.push({ category: "lib", name: m[1], folder: `src/lib/${m[1]}`, tier1: section === first });
    }
  }
  for (const n of dirsIn(root, "src/domains/core")) items.push({ category: "features", name: n, folder: `src/domains/core/${n}`, tier1: true });
  for (const n of dirsIn(root, "src/domains").filter((n) => n !== "core")) items.push({ category: "features", name: n, folder: `src/domains/${n}`, tier1: false });
  for (const n of dirsIn(root, "src/components")) items.push({ category: "components", name: n, folder: `src/components/${n}`, tier1: true });
  return items.map((it) => ({ ...it, hasReadme: existsSync(join(root, it.folder, "README.md")) }));
}
