// scripts/runner/seed/scan.ts
// ドメインのシード src/features/<ドメイン>/seed.ts(core は src/features/core/<ドメイン>/seed.ts)を走査して読み込む(一覧ファイルは持たない)。
// ドメイン名 = フォルダ名。閉じた機能の判定 = そのフォルダ(src/features からの相対)を features に持つ規則が閉じているか。
// 利用者: scripts/runner/seed/run.ts・テスト

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { SeedDefinition, SeedEntry } from "../../../src/lib/seed";

export type SeedFile = { domain: string; folder: string; file: string };

const dirsIn = (abs: string): string[] =>
  existsSync(abs) ? readdirSync(abs, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];

/** seed.ts を持つドメイン(名前順) */
export function listSeedFiles(repoRoot: string): SeedFile[] {
  const out: SeedFile[] = [];
  const add = (domain: string, folder: string) => {
    const file = `src/features/${folder}/seed.ts`;
    if (existsSync(path.join(repoRoot, file))) out.push({ domain, folder, file });
  };
  for (const name of dirsIn(path.join(repoRoot, "src/features/core"))) add(name, `core/${name}`);
  for (const name of dirsIn(path.join(repoRoot, "src/features"))) if (name !== "core") add(name, name);
  const seen = new Map<string, string>();
  for (const f of out) {
    const prev = seen.get(f.domain);
    if (prev) throw new Error(`シードのドメイン名 ${f.domain} が ${prev} と ${f.file} の両方にあります`);
    seen.set(f.domain, f.file);
  }
  return out.sort((a, b) => (a.domain < b.domain ? -1 : 1));
}

/** 閉じた機能の規則(features = src/features からの相対のフォルダ)から、フォルダを閉じている規則の名前を返す */
export function closedByOf(rules: readonly { name: string; features?: readonly string[]; enabled: () => boolean }[]) {
  return (folder: string): string | null => rules.find((rule) => !rule.enabled() && (rule.features ?? []).includes(folder))?.name ?? null;
}

/** seed.ts を読み込む(export const seed) */
export async function loadSeedEntries(repoRoot: string, files: readonly SeedFile[], closedBy: (folder: string) => string | null): Promise<SeedEntry[]> {
  const entries: SeedEntry[] = [];
  for (const f of files) {
    const mod = (await import(pathToFileURL(path.join(repoRoot, f.file)).href)) as { seed?: SeedDefinition };
    if (!mod.seed || typeof mod.seed.tables !== "object") throw new Error(`${f.file} が export const seed = defineSeed({ ... }) を持っていません`);
    entries.push({ ...f, seed: mod.seed, closedBy: closedBy(f.folder) });
  }
  return entries;
}
