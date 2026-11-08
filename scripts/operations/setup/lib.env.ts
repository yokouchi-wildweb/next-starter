// scripts/operations/setup/lib.env.ts — pnpm ops setup env の部品(env.ts と env.test.ts が使う)
// .env.example を写して段階の印 APP_ENV を書き、空の必須値だけ埋める。既にあるファイルは触らない(上書きしない)。

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AppEnv } from "@/lib/appEnv";

/** 引数なしで作るファイル(env の規則: 開発と本番の 2 つを必ず置く。src/lib/appEnv/README.md「env ファイルの規則」) */
export const DEFAULT_ENV_FILES = [".env.development", ".env.production"] as const;

/** ファイル名から段階の印を決める(.env.staging* → staging / .env.production* → production / ほか → development) */
export const stageOf = (name: string): AppEnv =>
  name.startsWith(".env.production") ? "production" : name.startsWith(".env.staging") ? "staging" : "development";

/** APP_ENV の行を段階に書き換える(無ければ先頭に足す)。.env.example の development をそのまま本番のファイルに写さない */
const setStage = (lines: string[], stage: AppEnv): void => {
  const index = lines.findIndex((line) => /^APP_ENV=/.test(line));
  if (index >= 0) lines[index] = `APP_ENV=${stage}`;
  else lines.unshift(`APP_ENV=${stage}`);
};

/** 空の行にだけ値を入れる。キーが無ければ末尾に追記する */
const fillIfEmpty = (lines: string[], key: string, value: string): "filled" | "kept" | "appended" => {
  const pattern = new RegExp(`^${key}=(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    const current = match[1].trim().replace(/^['"]|['"]$/g, "");
    if (current.length > 0) return "kept";
    lines[i] = `${key}=${value}`;
    return "filled";
  }
  lines.push(`${key}=${value}`);
  return "appended";
};

export type EnvFileResult =
  | { name: string; created: false }
  | { name: string; created: true; stage: AppEnv; results: Record<string, "filled" | "kept" | "appended"> };

export const isEnvFileName = (name: string): boolean => /^\.env(\..+)?$/.test(name) && name !== ".env.example";

/** 1 つ作る(既にあれば何もしない)。秘密はファイルごとに別の値。APP_BASE_URL は開発だけ localhost を入れる(本番は人が書く) */
export function createEnvFile(repoRoot: string, name: string): EnvFileResult {
  const targetPath = path.join(repoRoot, name);
  if (existsSync(targetPath)) return { name, created: false };
  const lines = readFileSync(path.join(repoRoot, ".env.example"), "utf8").split("\n");
  const stage = stageOf(name);
  setStage(lines, stage);
  const results: Record<string, "filled" | "kept" | "appended"> = {
    ...(stage === "development" ? { APP_BASE_URL: fillIfEmpty(lines, "APP_BASE_URL", "http://localhost:3000") } : {}),
    AUTH_JWT_SECRET: fillIfEmpty(lines, "AUTH_JWT_SECRET", randomBytes(32).toString("base64")),
    ENCRYPTION_KEY: fillIfEmpty(lines, "ENCRYPTION_KEY", randomBytes(32).toString("hex")),
  };
  writeFileSync(targetPath, lines.join("\n"), { mode: 0o600 });
  return { name, created: true, stage, results };
}
