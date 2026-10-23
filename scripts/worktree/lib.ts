// scripts/worktree/lib.ts
//
// worktree:new / worktree:sync / worktree:remove の共通処理。
// 持ち込み対象 = 「scripts/worktree/include のパターンに一致」かつ「gitignore 対象」のファイルだけ
// (Claude Code の .worktreeinclude と同じ規則。直下に置かないため Claude Code 自身は読まない)。
// パターン解釈は git 自身に任せる (自前の gitignore パーサーを持たない)。

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** 持ち込み一覧 (リポジトリのルートからの相対パス) */
export const INCLUDE_FILE = "scripts/worktree/include";

export const git = (args: string[], cwd: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** 終了コードだけ見たい git コマンド用 */
export const gitSucceeds = (args: string[], cwd: string): boolean => {
  try {
    execFileSync("git", args, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/** cwd を含むワークツリーのルート */
export const worktreeRoot = (cwd: string): string => git(["rev-parse", "--show-toplevel"], cwd);

/** 本体ワークツリー (git worktree add の元になったチェックアウト) のルート。ワークツリーの中から呼んでも本体を返す */
export const mainWorktreeRoot = (cwd: string): string =>
  path.dirname(git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd));

/** pnpm run は package.json の場所で実行されるため、呼び出し元のディレクトリは INIT_CWD から取る */
export const invocationDir = (): string => process.env.INIT_CWD ?? process.cwd();

/** ブランチ名をフォルダ名に使える形にする (feature/foo → feature-foo) */
export const branchSlug = (branch: string): string => branch.replace(/[^A-Za-z0-9._-]+/g, "-");

/** 既定の置き場所: 本体の隣の <repo名>.wt-<branch> */
export const defaultWorktreePath = (mainRoot: string, branch: string): string =>
  path.resolve(mainRoot, "..", `${path.basename(mainRoot)}.wt-${branchSlug(branch)}`);

const splitNul = (output: string): string[] => output.split("\0").filter((entry) => entry.length > 0);

/** root (本体ワークツリー) 内の持ち込み対象ファイル (root からの相対パス、ソート済み) */
export const listIncludedFiles = (root: string): string[] => {
  const includePath = path.join(root, INCLUDE_FILE);
  if (!existsSync(includePath)) return [];

  // パターンに一致する未追跡ファイル (gitignore 対象かどうかは問わない)
  const matched = splitNul(
    execFileSync("git", ["ls-files", "-z", "--others", "--ignored", `--exclude-from=${includePath}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  if (matched.length === 0) return [];

  // そのうち gitignore 対象のものだけ残す (check-ignore は 1 件も一致しないと終了コード 1)
  let ignored: string[] = [];
  try {
    ignored = splitNul(
      execFileSync("git", ["check-ignore", "-z", "--stdin"], {
        cwd: root,
        encoding: "utf8",
        input: matched.join("\0"),
      }),
    );
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error;
  }
  return [...new Set(ignored)].sort();
};

export type CopyResult = {
  /** 新規に複製したもの */
  copied: string[];
  /** --force で上書きしたもの */
  overwritten: string[];
  /** 既にあり内容が同じだったもの */
  unchanged: string[];
  /** 既にあり内容が違うため触らなかったもの */
  differs: string[];
};

/** files を from → to へ複製する。既存ファイルは force のときだけ上書き */
export const copyIncludedFiles = (from: string, to: string, files: string[], options: { force?: boolean } = {}) => {
  const result: CopyResult = { copied: [], overwritten: [], unchanged: [], differs: [] };
  for (const file of files) {
    const source = path.join(from, file);
    const target = path.join(to, file);
    if (existsSync(target)) {
      if (readFileSync(source).equals(readFileSync(target))) {
        result.unchanged.push(file);
        continue;
      }
      if (!options.force) {
        result.differs.push(file);
        continue;
      }
      copyFileSync(source, target);
      result.overwritten.push(file);
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    result.copied.push(file);
  }
  return result;
};

export const printCopyResult = (result: CopyResult) => {
  const sections: [string, string[]][] = [
    ["複製", result.copied],
    ["上書き", result.overwritten],
    ["同一のため省略", result.unchanged],
    ["内容が違うため未変更 (上書きは --force)", result.differs],
  ];
  for (const [label, files] of sections) {
    if (files.length === 0) continue;
    console.log(`  ${label}:`);
    for (const file of files) console.log(`    ${file}`);
  }
  if (sections.every(([, files]) => files.length === 0)) {
    console.log(`  持ち込み対象なし (${INCLUDE_FILE} を確認)`);
  }
};
