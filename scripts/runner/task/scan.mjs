// scripts/runner/task/scan.mjs
// ドメインのタスク・移行のファイルを走査する(一覧ファイルは持たない。ファイルは読み込まない)。
// 置き場: src/features/<ドメイン>/scripts/tasks/<名前>.ts(繰り返しの運用・機能を有効にするたびの導入)と
//         src/features/<ドメイン>/scripts/migrations/<名前>.ts(notice が名指す 1 回きり)。core のドメインは src/features/core/<ドメイン>/。
// 名前 = <ドメイン>:<名前>(ドメイン = フォルダ名。ドメインが違えば同じ <名前> でも衝突しない)。定期タスク(cron)は平らな名前のまま。
// タスクでない物: *.test.*・lib.*(タスクの間で共有する部品)・下のフォルダ・.local.ts(git に入れない移行、まだ扱わない)・.ts 以外。
// 利用者: scripts/runner/task/discover.ts(pnpm task)・scripts/workflow/notices/notices.test.mjs(notice が案内する task の実在)。
// node でも tsx でも読めるよう .mjs にしてある。

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { classifyDottedName, oldMarkerProblem } from "../../../src/lib/forkOwnership/dottedNames.mjs";

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
const NOT_A_TASK = (file) => /\.test\.[cm]?ts$/.test(file) || /^lib\./.test(file) || /\.local\.ts$/.test(file) || !file.endsWith(".ts");

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
 * タスクと移行を名前順に集める: { tasks: [{ name, domain, kind, file }], problems: [文] }。
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
        if (!entry.isFile() || NOT_A_TASK(entry.name)) continue;
        const file = `${rel}/${entry.name}`;
        const match = TASK_FILE.exec(entry.name);
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
        byName.set(name, { name, domain, kind: place.kind, file });
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

/** 文の中の `pnpm task <名前>` の名前(--list などの旗と <名前> の型は除く) */
export function taskNamesIn(text) {
  return [...new Set([...text.matchAll(/pnpm task ([A-Za-z][A-Za-z0-9]*(?::[a-z0-9]+(?:-[a-z0-9]+)*|(?:-[a-z0-9]+)*))/g)].map((m) => m[1]))];
}
