// src/lib/folderCatalog/catalog.mjs
//
// フォルダ目録(CATALOG.md)の読み込み・検査・所有判定。
// 目録 = 「そのフォルダ直下のディレクトリ(ライブラリ等)を、どのリポジトリが作ったか」の一覧。
// 所有者ごとの節(上流から順、先頭 = Tier1)に、1 行 1 ディレクトリで「パス — 一行説明」を書く。
//
//   ## next-starter
//   - src/lib/ai — 汎用 AI エージェント基盤
//
// 所有者 ID = 各リポの fork の名前(.claude/rules/project.md の fork_id:、読み手は forkOwnership/forkIds.mjs。D27)。
// origin の URL からは導かない。
// テスト(pnpm test:lib-catalog)と eslint.config.mjs(所有に応じた error / warn の振り分け)から使う。
// Node 組み込みだけで動くこと(eslint 設定の読み込み時に実行される)。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { FORK_ID_PATTERN, readForkIdentity } from "../forkOwnership/forkIds.mjs";

const OWNER_ID = FORK_ID_PATTERN;
const SECTION_LINE = /^##\s+(.+?)\s*$/;
const ENTRY_LINE = /^-\s+(\S+)\s+—\s+(.*)$/;

/**
 * 目録テキストを解析する。最初の `## ` 見出しより前は説明文として読み飛ばす。
 * @param {string} text
 * @returns {{ sections: { owner: string, line: number, entries: { path: string, description: string, line: number }[] }[], errors: string[] }}
 */
export function parseCatalog(text) {
  const sections = [];
  const errors = [];
  let current = null;
  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trimEnd();
    const section = SECTION_LINE.exec(line);
    if (section) {
      const owner = section[1];
      if (!OWNER_ID.test(owner)) {
        errors.push(`${lineNo} 行目: 節の見出し "${owner}" が fork の名前の形(小文字・数字・ハイフン。project.md の fork_id:)ではありません`);
      }
      current = { owner, line: lineNo, entries: [] };
      sections.push(current);
      return;
    }
    if (!current || !line.startsWith("- ")) return;
    const entry = ENTRY_LINE.exec(line);
    if (!entry) {
      errors.push(`${lineNo} 行目: 書式が違います("- <パス> — <一行説明>")`);
      return;
    }
    const description = entry[2].trim();
    if (!description) {
      errors.push(`${lineNo} 行目: ${entry[1]} の説明が空です`);
    }
    current.entries.push({ path: entry[1], description, line: lineNo });
  });
  return { sections, errors };
}

/**
 * 目録と実在するディレクトリの整合を検査する。問題が無ければ空配列。
 * @param {{ sections: ReturnType<typeof parseCatalog>["sections"], folder: string, dirs: string[] }} input
 *   folder = 目録の対象フォルダ(例 "src/lib")、dirs = その直下に実在するディレクトリ名
 */
export function checkCatalog({ sections, folder, dirs }) {
  const problems = [];
  const owners = new Map();
  for (const section of sections) {
    if (owners.has(section.owner)) {
      problems.push(`所有者 "${section.owner}" の節が 2 つあります(${owners.get(section.owner)} 行目と ${section.line} 行目)。1 つにまとめてください`);
    } else {
      owners.set(section.owner, section.line);
    }
  }

  const listed = new Map(); // path → [{owner, line}]
  for (const section of sections) {
    for (const entry of section.entries) {
      const prefix = `${folder}/`;
      const name = entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : null;
      if (!name || name.includes("/")) {
        problems.push(`${entry.line} 行目: "${entry.path}" は ${folder} 直下のディレクトリのパスではありません`);
        continue;
      }
      const hits = listed.get(entry.path) ?? [];
      hits.push({ owner: section.owner, line: entry.line });
      listed.set(entry.path, hits);
    }
  }

  for (const [path, hits] of listed) {
    if (hits.length > 1) {
      const where = hits.map((h) => `${h.owner}(${h.line} 行目)`).join(" と ");
      problems.push(`"${path}" が ${where} に重複しています。名前の衝突なら自分の側を改名、上流へ昇格済みなら自分の複製と行を削除してください`);
    }
  }

  const dirSet = new Set(dirs.map((name) => `${folder}/${name}`));
  for (const path of dirSet) {
    if (!listed.has(path)) {
      problems.push(`"${path}" が目録にありません。作った側の節に "- ${path} — <一行説明>" を足してください`);
    }
  }
  for (const [path, hits] of listed) {
    if (!dirSet.has(path)) {
      problems.push(`"${path}"(${hits[0].owner} の節、${hits[0].line} 行目)が実在しません。上流のディレクトリは削除しない / 自分の節の行なら削除してください`);
    }
  }
  return problems;
}

/** フォルダ直下のディレクトリ名(隠しディレクトリを除く) */
export function listDirs(repoRoot, folder) {
  const abs = join(repoRoot, folder);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

/**
 * 目録から所有を判定する。目録が読めない・自分の ID が分からないときは「自分の所有なし」(安全側)。
 * @param {{ repoRoot: string, folder: string, catalogFile?: string, ownerId?: string | null }} input
 * @returns {{ ownerId: string | null, isRoot: boolean, ownPaths: string[], upstreamPaths: string[] }}
 */
export function loadCatalogOwnership({ repoRoot, folder, catalogFile = `${folder}/CATALOG.md`, ownerId }) {
  const resolvedOwner = ownerId === undefined ? readForkIdentity(repoRoot).own : ownerId;
  const empty = { ownerId: resolvedOwner, isRoot: false, ownPaths: [], upstreamPaths: [] };
  let text;
  try {
    text = readFileSync(join(repoRoot, catalogFile), "utf8");
  } catch {
    return empty;
  }
  const { sections } = parseCatalog(text);
  if (sections.length === 0) return empty;
  const isRoot = resolvedOwner !== null && sections[0].owner === resolvedOwner;
  const ownPaths = [];
  const upstreamPaths = [];
  for (const section of sections) {
    const target = resolvedOwner !== null && section.owner === resolvedOwner ? ownPaths : upstreamPaths;
    for (const entry of section.entries) target.push(entry.path);
  }
  return { ownerId: resolvedOwner, isRoot, ownPaths, upstreamPaths };
}
