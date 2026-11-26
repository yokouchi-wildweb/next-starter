// scripts/structure/lib-package/declare.mjs
//
// 宣言の道具(pnpm check lib-package -- declare): 宣言の無い自分の lib(src/lib/CATALOG.md の自分の節の lib)に package.json と
// 単体用 tsconfig.json を書く。宣言の無い lib は検査が undeclared で落とすので、fork が自前の lib を閉じる入り口(K6)。
// - 入口: lib の中のファイルの名前から(index.* → "."、server(.*|/index.*) → "./server"、client → "./client"、node → "./node")
// - libs / peers: lib のファイル(テストも。単体用 tsconfig が型検査する)の import が解ける先から(src/lib/<他> → libs、src/components → peers)
// - 決めきれない所は一覧に出す(書く物は変えない): 外から入口でない中のファイルを読む import(読み手の場所から入口の候補を添える)、
//   lib が読めない所(features・app・hooks・utils・@/config など)を読む import、入口のファイルが 1 つも無い
// - 祖先の lib(自分の節に無い lib)と宣言済みの lib は拒む(触らない)
// 既定は dry-run(書かない)、--apply で書く。書いた後は外から中を読む import を入口へ直し(pnpm lint の entry/only-entries が名指す)→ pnpm check lib-package の順

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { isUnder, resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { loadCatalogOwnership } from "../../../src/lib/folderCatalog/node.mjs";
import { ENTRY_NAMES, LIB_DIR, PEER_DIRS, findEntry, libOfPath } from "../../../src/lib/libPackage/index.mjs";
import { clearLibPackageCache, hasLibPackage, listLibs } from "../../../src/lib/libPackage/node.mjs";
import { scanFiles } from "./closed.mjs";
import { LIB_CONFIG_PREFIX } from "./configSlots.mjs";
import { expectedTsconfig } from "./standalone.mjs";

const EXTENSIONS = ["ts", "tsx", "mts", "mjs", "js", "jsx", "cjs"];
const EXT_RE = /\.(ts|tsx|mts|mjs|js|jsx|cjs)$/;

/** 解いたパス(拡張子・index の有無を問わない)を実在するファイル(repo 相対)に。無ければ null */
function probeFile(root, resolved) {
  if (!resolved) return null;
  const candidates = EXT_RE.test(resolved) ? [resolved] : [];
  for (const ext of EXTENSIONS) candidates.push(`${resolved}.${ext}`);
  for (const ext of EXTENSIONS) candidates.push(`${resolved}/index.${ext}`);
  // "./x.js" と書いて x.ts を指す書き方
  if (EXT_RE.test(resolved)) for (const ext of EXTENSIONS) candidates.push(resolved.replace(EXT_RE, `.${ext}`));
  return candidates.find((c) => !c.endsWith("/") && existsSync(path.join(root, c))) ?? null;
}

const SOURCE_RE = /\.(ts|tsx|mts|mjs|js|jsx|cjs)$/;
const ENTRY_EXT = ["ts", "tsx", "mts", "mjs", "js"];

export const USAGE = "pnpm check lib-package -- declare [<lib>...] [--apply] [--json]  (lib を書かなければ自分の節の宣言の無い lib 全部)";

/**
 * 入口の名前ごとの候補のファイル(lib の中の相対)。先に当たった物
 * @param {string} name "." | "./server" | "./client" | "./node"
 */
const entryCandidates = (name) => {
  const base = name === "." ? "index" : name.slice(2);
  const files = ENTRY_EXT.map((ext) => `${base}.${ext}`);
  if (name !== ".") files.push(...ENTRY_EXT.map((ext) => `${base}/index.${ext}`));
  return files;
};

/**
 * 読み手の場所から入口の候補(決めきれない所に添えるだけ)
 * @param {string} importer repo 相対
 */
export function suggestEntry(importer) {
  if (/^(scripts|eslint-rules|servers)\//.test(importer)) return "./node";
  if (/(^|\/)services\/server\//.test(importer) || importer.startsWith("src/app/api/") || /(^|\/)server(\/|\.)/.test(importer)) return "./server";
  return ".";
}

function walk(root, rel) {
  const out = [];
  for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") out.push(...walk(root, child));
    } else if (SOURCE_RE.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(child);
  }
  return out;
}

/** @param {string} text */
const importsOf = (text) => ts.preProcessFile(text, true, true).importedFiles.map((i) => i.fileName).filter(Boolean);

/**
 * 1 つの lib の宣言の案(書かない)
 * @param {string} root
 * @param {string} lib
 * @param {{ ownerId?: string | null, files?: string[] }} [opts] ownerId = 自分の repo_id(既定 repo.json)、files = 走査するファイル(既定 scanFiles)
 */
export function planDeclare(root, lib, { ownerId, files } = {}) {
  const dir = `${LIB_DIR}/${lib}`;
  if (!listLibs(root).includes(lib)) return { lib, status: "refused", reason: `${dir} がありません` };
  if (hasLibPackage(root, lib)) return { lib, status: "refused", reason: `${dir} は宣言済みです(package.json がある)` };
  const ownership = loadCatalogOwnership({ repoRoot: root, folder: LIB_DIR, ...(ownerId === undefined ? {} : { ownerId }) });
  if (!ownership.ownPaths.includes(dir)) {
    const reason = ownership.upstreamPaths.includes(dir)
      ? `${dir} は祖先の lib です(src/lib/CATALOG.md の自分の節に無い)。宣言は持ち主が行う(/order <直の親>)`
      : `${dir} は src/lib/CATALOG.md の自分の節(${ownership.ownerId ?? "repo_id 不明"})にありません。先に自分の節へ行を足す`;
    return { lib, status: "refused", reason };
  }

  // 入口
  /** @type {Record<string, string>} */
  const exportsMap = {};
  for (const name of ENTRY_NAMES) {
    const hit = entryCandidates(name).find((f) => existsSync(path.join(root, dir, f)));
    if (hit) exportsMap[name] = `./${hit}`;
  }
  const planned = { dir, exports: Object.keys(exportsMap).map((key) => ({ key, keyPath: key === "." ? "" : key.slice(2) })) };

  /** @type {{ kind: string, file: string, specifier: string, detail: string }[]} */
  const unresolved = [];
  if (Object.keys(exportsMap).length === 0) {
    unresolved.push({ kind: "noEntry", file: dir, specifier: "", detail: `入口のファイルがありません(${ENTRY_NAMES.map((n) => entryCandidates(n)[0]).join(" / ")} のどれかを置く)` });
  }

  // libs / peers と、lib が読めない所
  const libs = new Set();
  const peers = new Set();
  for (const file of walk(root, dir)) {
    for (const spec of importsOf(readFileSync(path.join(root, file), "utf8"))) {
      if (spec.startsWith(LIB_CONFIG_PREFIX)) continue;
      const resolved = resolveImport(spec, path.join(root, file), root);
      if (!resolved) continue;
      const target = libOfPath(resolved);
      if (target === lib) continue;
      if (target) {
        libs.add(target);
        continue;
      }
      const peer = Object.keys(PEER_DIRS).find((p) => isUnder(resolved, PEER_DIRS[p]));
      if (peer) {
        peers.add(peer);
        continue;
      }
      if (isUnder(resolved, dir)) continue;
      unresolved.push({ kind: "outside", file, specifier: spec, detail: `lib は ${resolved} を読めません(引数・注入で受けるか、値なら設定 config.ts に: src/lib/README.md 手順 1)` });
    }
  }

  // 外から中のファイルを読む import
  for (const file of files ?? scanFiles(root)) {
    if (isUnder(file, dir)) continue;
    for (const spec of importsOf(readFileSync(path.join(root, file), "utf8"))) {
      if (spec.startsWith(LIB_CONFIG_PREFIX)) continue;
      const resolved = resolveImport(spec, path.join(root, file), root);
      if (!resolved || libOfPath(resolved) !== lib) continue;
      if (findEntry(planned, resolved)) continue;
      const suggest = suggestEntry(file);
      unresolved.push({
        kind: "inner",
        file,
        specifier: spec,
        detail: `入口でない ${probeFile(root, resolved) ?? resolved} を読みます。読む名前を入口(候補 ${suggest}${exportsMap[suggest] ? "" : "。そのファイルはまだ無い"})から出し、呼び手をその入口に直す(lint entry/only-entries が名指す)`,
      });
    }
  }

  const packageJson = {
    exports: exportsMap,
    libs: [...libs].sort(),
    ...(peers.size > 0 ? { peers: [...peers].sort() } : {}),
  };
  const tsconfig = expectedTsconfig(root, lib, { libs: packageJson.libs, peers: packageJson.peers ?? [] });
  return { lib, status: "plan", packageJson, tsconfig, unresolved };
}

/**
 * 案を書く(package.json と tsconfig.json。tsconfig.json が既にあれば上書きする)
 * @param {string} root
 * @param {{ lib: string, packageJson: object, tsconfig: object }} plan
 */
export function applyDeclare(root, plan) {
  const dir = path.join(root, LIB_DIR, plan.lib);
  writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(plan.packageJson, null, 2)}\n`);
  writeFileSync(path.join(dir, "tsconfig.json"), `${JSON.stringify(plan.tsconfig, null, 2)}\n`);
  clearLibPackageCache();
}

/**
 * 自分の節の宣言の無い lib(lib を名指ししない時の対象)
 * @param {string} root
 * @param {string | null | undefined} [ownerId]
 */
export function ownUndeclaredLibs(root, ownerId) {
  const { ownPaths } = loadCatalogOwnership({ repoRoot: root, folder: LIB_DIR, ...(ownerId === undefined ? {} : { ownerId }) });
  return listLibs(root).filter((lib) => ownPaths.includes(`${LIB_DIR}/${lib}`) && !hasLibPackage(root, lib));
}

/** CLI。exit 0 = 拒む・決めきれない所が無い / 1 = どちらかがある / 2 = 引数の誤り */
export function runDeclare(root, argv = [], { stdout = process.stdout } = {}) {
  const flags = new Set();
  const names = [];
  for (const arg of argv) {
    if (arg === "--apply" || arg === "--json") flags.add(arg);
    else if (arg === "--") continue;
    else if (arg.startsWith("-")) {
      stdout.write(`lib-package declare: 知らない引数 ${arg}(${USAGE})\n`);
      return 2;
    } else names.push(arg);
  }
  const apply = flags.has("--apply");
  const targets = names.length > 0 ? names : ownUndeclaredLibs(root);
  const files = scanFiles(root);
  const plans = targets.map((lib) => planDeclare(root, lib, { files }));
  if (apply) for (const plan of plans) if (plan.status === "plan") applyDeclare(root, plan);
  const bad = plans.some((p) => p.status === "refused" || (p.unresolved?.length ?? 0) > 0);
  if (flags.has("--json")) {
    stdout.write(`${JSON.stringify({ apply, plans }, null, 2)}\n`);
    return bad ? 1 : 0;
  }
  if (plans.length === 0) stdout.write("lib-package declare: 自分の節に宣言の無い lib はありません\n");
  for (const plan of plans) {
    if (plan.status === "refused") {
      stdout.write(`拒む ${plan.lib}: ${plan.reason}\n`);
      continue;
    }
    stdout.write(`${apply ? "書いた" : "書く(dry-run)"} ${LIB_DIR}/${plan.lib}/package.json ${JSON.stringify(plan.packageJson)}\n`);
    stdout.write(`${apply ? "書いた" : "書く(dry-run)"} ${LIB_DIR}/${plan.lib}/tsconfig.json ${JSON.stringify(plan.tsconfig)}\n`);
    for (const u of plan.unresolved) stdout.write(`決めきれない ${u.kind} ${u.file}${u.specifier ? ` ${u.specifier}` : ""}(${u.detail})\n`);
  }
  stdout.write(
    `lib-package declare: ${apply ? "書いた" : "dry-run(書くのは --apply)"} ${plans.filter((p) => p.status === "plan").length} lib・拒む ${plans.filter((p) => p.status === "refused").length}・決めきれない ${plans.reduce((n, p) => n + (p.unresolved?.length ?? 0), 0)}` +
      `(次: 外から中を読む import を入口へ(pnpm lint が名指す)→ pnpm check lib-package)\n`,
  );
  return bad ? 1 : 0;
}
