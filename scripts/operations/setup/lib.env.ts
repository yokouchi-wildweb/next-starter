// scripts/operations/setup/lib.env.ts — pnpm ops setup env の部品(env.ts と env.test.ts が使う)
// .env.example を写して段階の印 APP_ENV を書き、空の必須値だけ埋める。
// 既にあるファイルは上書きしない: 作った秘密の鍵(GENERATED_SECRETS)のうち、無いか空の鍵だけを足す(値の入った鍵・ほかの行は触らない)。

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

/** setup env が乱数で作る秘密の鍵(ファイルごとに別の値)。新しい鍵はここに 1 行足す */
export const GENERATED_SECRETS: readonly { key: string; generate: () => string }[] = [
  { key: "AUTH_JWT_SECRET", generate: () => randomBytes(32).toString("base64") },
  { key: "ENCRYPTION_KEY", generate: () => randomBytes(32).toString("hex") },
  // ワンクリックの配信停止の署名の鍵(messaging の unsubscribe)
  { key: "MESSAGING_UNSUBSCRIBE_SECRET", generate: () => randomBytes(32).toString("base64url") },
];

export type EnvFileResult =
  | { name: string; created: false; added: string[] }
  | { name: string; created: true; stage: AppEnv; results: Record<string, "filled" | "kept" | "appended"> };

export const isEnvFileName = (name: string): boolean => /^\.env(\..+)?$/.test(name) && name !== ".env.example";

/**
 * 既にあるファイルに、作った秘密の鍵のうち無いか空の鍵だけを足す(値の入った鍵・APP_BASE_URL・ほかの行は触らない)。
 * @returns 足した鍵の名前(無ければ空。ファイルは書かない)
 */
export function fillMissingKeys(targetPath: string): string[] {
  const original = readFileSync(targetPath, "utf8");
  const lines = original.split("\n");
  // 末尾の改行を保つ(追記は最後の空行の前に入れる)
  const trailingNewline = lines.length > 0 && lines[lines.length - 1] === "";
  if (trailingNewline) lines.pop();
  const added: string[] = [];
  for (const { key, generate } of GENERATED_SECRETS) {
    const result = fillIfEmpty(lines, key, generate());
    if (result !== "kept") added.push(key);
  }
  if (added.length === 0) return [];
  writeFileSync(targetPath, lines.join("\n") + (trailingNewline ? "\n" : ""));
  return added;
}

/**
 * 1 つ作る。秘密はファイルごとに別の値。APP_BASE_URL は開発だけ localhost を入れる(本番は人が書く)。
 * 既にあれば上書きせず、作った秘密の鍵のうち無いか空の鍵だけを足す(fillMissingKeys)
 */
export function createEnvFile(repoRoot: string, name: string): EnvFileResult {
  const targetPath = path.join(repoRoot, name);
  if (existsSync(targetPath)) return { name, created: false, added: fillMissingKeys(targetPath) };
  const lines = readFileSync(path.join(repoRoot, ".env.example"), "utf8").split("\n");
  const stage = stageOf(name);
  setStage(lines, stage);
  const results: Record<string, "filled" | "kept" | "appended"> = {
    ...(stage === "development" ? { APP_BASE_URL: fillIfEmpty(lines, "APP_BASE_URL", "http://localhost:3000") } : {}),
  };
  for (const { key, generate } of GENERATED_SECRETS) results[key] = fillIfEmpty(lines, key, generate());
  writeFileSync(targetPath, lines.join("\n"), { mode: 0o600 });
  return { name, created: true, stage, results };
}
