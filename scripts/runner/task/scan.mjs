// scripts/runner/task/scan.mjs
// ドメインのタスク・移行のファイルを走査する(一覧ファイルは持たない。ファイルは読み込まない)。
// 置き場: src/features/<ドメイン>/scripts/tasks/<名前>.ts(繰り返しの運用・機能を有効にするたびの導入)と
//         src/features/<ドメイン>/scripts/migrations/<名前>.ts(notice が名指す 1 回きり)。core のドメインは src/features/core/<ドメイン>/。
// 名前 = <ドメイン>:<名前>(ドメイン = フォルダ名。ドメインが違えば同じ <名前> でも衝突しない)。定期タスク(cron)は平らな名前のまま。
// git に入れない移行 = scripts/migrations/<名前>.local.ts(local: true、名前は同じ <ドメイン>:<名前>。.gitignore の 1 行、src/lib/task/README.md)。
// タスクでない物: *.test.*・lib.*(タスクの間で共有する部品)・下のフォルダ・scripts/tasks の .local.ts・.ts 以外。
// 利用者: scripts/runner/task/discover.ts(pnpm task)・scripts/workflow/notices/notices.test.mjs(notice が案内する task の実在)。
// node でも tsx でも読めるよう .mjs にしてある。

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { classifyDottedName, oldMarkerProblem } from "../../../src/lib/districtMap/dottedNames.mjs";

const FEATURES = "src/features";
const CORE = "src/features/core";
/** 種類 → ドメインの中の置き場 */
export const TASK_PLACES = [
  { kind: "task", dir: "scripts/tasks" },
  { kind: "migration", dir: "scripts/migrations" },
];
/** 計画書 07 より前の置き場(無くなった。残っていれば移し方を出して止める) */
export const LEGACY_TASKS_DIR = "scripts/tasks";
const TASK_FILE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.ts$/;
const LOCAL_FILE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.local\.ts$/;
const NOT_A_TASK = (file, kind) => /\.test\.[cm]?ts$/.test(file) || /^lib\./.test(file) || (kind !== "migration" && /\.local\.ts$/.test(file)) || !file.endsWith(".ts");

const dirsIn = (abs) => (existsSync(abs) ? readdirSync(abs, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);

/** ドメインのフォルダ: [{ domain, dir }](dir はリポジトリ直下からの相対) */
export function domainDirs(repoRoot) {
  const business = dirsIn(path.join(repoRoot, FEATURES))
    .filter((name) => name !== "core")
    .map((domain) => ({ domain, dir: `${FEATURES}/${domain}` }));
  const core = dirsIn(path.join(repoRoot, CORE)).map((domain) => ({ domain, dir: `${CORE}/${domain}` }));
  return [...core, ...business];
}

/**
 * タスクと移行を名前順に集める: { tasks: [{ name, domain, kind, file, local }], problems: [文] }(local = git に入れない移行 <名前>.local.ts)。
 * problems = 置き方の誤り(名前の形・同じ名前が 2 つ・古い置き場 scripts/tasks に残ったファイル)
 */
export function scanTasks(repoRoot) {
  const problems = [];
  const byName = new Map();
  for (const { domain, dir } of domainDirs(repoRoot)) {
    for (const place of TASK_PLACES) {
      const rel = `${dir}/${place.dir}`;
      const abs = path.join(repoRoot, rel);
      if (!existsSync(abs)) continue;
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        if (!entry.isFile() || NOT_A_TASK(entry.name, place.kind)) continue;
        const file = `${rel}/${entry.name}`;
        const localMatch = place.kind === "migration" ? LOCAL_FILE.exec(entry.name) : null;
        const match = localMatch ?? TASK_FILE.exec(entry.name);
        if (!match) {
          const shape = classifyDottedName(entry.name);
          if (shape.kind === "marker" && TASK_FILE.test(`${shape.base}.ts`)) problems.push(oldMarkerProblem(file, `${shape.base}.ts`));
          else problems.push(`${file}: タスクのファイル名は <kebab-case の名前>.ts(共有の部品は lib.<名前>.ts)`);
          continue;
        }
        const name = `${domain}:${match[1]}`;
        const prev = byName.get(name);
        if (prev) {
          problems.push(`タスク名 "${name}" が ${prev.file} と ${file} の両方にあります`);
          continue;
        }
        byName.set(name, { name, domain, kind: place.kind, file, local: localMatch !== null });
      }
    }
  }
  problems.push(...legacyProblems(repoRoot));
  const tasks = [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
  return { tasks, problems };
}

/** 古い置き場 scripts/tasks に残ったタスクのファイル(fork が足した物)に移し方を出す */
export function legacyProblems(repoRoot) {
  const abs = path.join(repoRoot, LEGACY_TASKS_DIR);
  if (!existsSync(abs)) return [];
  const files = readdirSync(abs, { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".ts"));
  return files.map((e) => {
    const file = path.relative(repoRoot, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join("/");
    return (
      `${file}: タスクの置き場 scripts/tasks は無くなりました。持ち主のドメインの src/features/<ドメイン>/scripts/tasks/<名前>.ts へ移し` +
      `(notice が名指す 1 回きりの移行は scripts/migrations/)、task.name を "<ドメイン>:<名前>" にします(共有の部品は lib.<名前>.ts、型は @/lib/task)`
    );
  });
}

/** 定期タスクの名前(src/app/api/cron/<名前>/task.ts のフォルダ名。ファイルは読み込まない) */
export function cronTaskNames(repoRoot) {
  const root = path.join(repoRoot, "src/app/api/cron");
  return dirsIn(root).filter((name) => existsSync(path.join(root, name, "task.ts"))).sort();
}

/**
 * 文の中の `pnpm task <名前>` の名前(--list などの旗と <名前> の型は除く)。
 * コードの中(インラインコード・コードブロック・コマンドだけの行)はどの形の名前も拾う。
 * 地の文では : か - を含む名前(<ドメイン>:<名前>、expire-pending-purchases)だけを拾い、
 * 「pnpm task lists ...」のような普通の単語は名前と読まない。
 */
export function taskNamesIn(text) {
  const code = codeRanges(text);
  const inCode = (i) => code.some(([from, to]) => i >= from && i < to);
  const names = [];
  for (const m of text.matchAll(/pnpm task ([A-Za-z][A-Za-z0-9]*(?::[a-z0-9]+(?:-[a-z0-9]+)*|(?:-[a-z0-9]+)*))/g)) {
    if (/[:-]/.test(m[1]) || inCode(m.index)) names.push(m[1]);
  }
  return [...new Set(names)];
}

/** コードとして書かれた範囲 [始め, 終わり) の一覧(``` の塊・`…`・コマンドだけの行) */
function codeRanges(text) {
  const ranges = [];
  const add = (re, source) => {
    for (const m of source.matchAll(re)) ranges.push([m.index, m.index + m[0].length]);
  };
  add(/```[\s\S]*?(?:```|$)/g, text);
  // インラインコードは塊の外だけで探す(塊を同じ長さの空白に置き換えて位置を保つ)
  let outside = text;
  for (const [from, to] of ranges) outside = outside.slice(0, from) + " ".repeat(to - from) + outside.slice(to);
  add(/`[^`\n]+`/g, outside);
  // コマンドだけの行(箇条書き・引用・番号・$ の後も可): 名前の後は行末か -- / - で始まる引数だけ。
  // 「pnpm task lists the domain tasks.」のように単語が続く行は文として扱う
  add(/^[ \t]*(?:(?:[-*+>]|\d+\.|\$)[ \t]+)*pnpm task [^\s`]+(?:[ \t]+-[^\n]*)?[ \t]*$/gm, text);
  return ranges;
}
