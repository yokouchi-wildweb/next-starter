// scripts/runner/task/record.ts
// 実行の記録に載せる値を集める(git の版と未コミットの印・実行者・段階・接続先・ファイルの中身のハッシュ)。DB には触らない。
// 利用者: scripts/runner/task/run.ts

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { getAppEnv } from "@/lib/appEnv";

export type RunMeta = {
  gitSha: string | null;
  gitDirty: boolean | null;
  actor: string;
  stage: string;
  dbTarget: string | null;
  fileHash: string | null;
};

const git = (repoRoot: string, args: string[]): string | null => {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

/** 接続文字列から host / DB 名だけ(ユーザー名・パスワード・問い合わせは捨てる)。読めなければ null */
export function dbTargetOf(url: string | undefined): string | null {
  if (!url || url.trim() === "") return null;
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return null;
  }
}

/** ファイルの中身の sha256(読めなければ null) */
export function fileHashOf(file: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
  } catch {
    return null;
  }
}

export function collectRunMeta(repoRoot: string, file: string | null): RunMeta {
  const sha = git(repoRoot, ["rev-parse", "HEAD"]);
  const status = sha === null ? null : git(repoRoot, ["status", "--porcelain", "--untracked-files=no"]);
  let user = "unknown";
  try {
    user = os.userInfo().username;
  } catch {
    user = process.env.USER ?? "unknown";
  }
  return {
    gitSha: sha,
    gitDirty: status === null ? null : status.length > 0,
    actor: `${user}@${os.hostname()}`,
    stage: getAppEnv(),
    dbTarget: dbTargetOf(process.env.DATABASE_URL),
    fileHash: file ? fileHashOf(path.join(repoRoot, file)) : null,
  };
}
