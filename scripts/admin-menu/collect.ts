// scripts/admin-menu/collect.ts
// 管理メニューの受け口(src/features/core/admin/menu/{categories,items})・ルート地図・門番の規則・設定の節を集める(読むだけ)。
// 受け口の項目は生成の一覧でなく素のファイルから読む(上書きの前の上流の値で allowRoles の広がりを見るため)。中身の判定は ./inspect.ts

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { rules } from "@/featureGate/node";
import { settingSectionRows } from "@/features/core/admin/menu/sources";
import type { AdminMenuRow } from "@/features/core/admin/menu/types";

import type { GateRuleView, MenuEntry, MenuSnapshot, OrphanOverride } from "./inspect";

/** リポジトリ直下(pnpm のスクリプトはここで走る) */
export const REPO_ROOT = resolve(process.cwd());
const MENU_DIR = "src/features/core/admin/menu";
const ROUTE_MAP = "src/app/route-map.jsonl";

const ITEM_FILE = /^([A-Za-z][A-Za-z0-9]*)\.tsx?$/;
const OVERRIDE_FILE = /^([A-Za-z][A-Za-z0-9]*)\.override\.tsx?$/;

const load = async (repoRoot: string, file: string, name: string): Promise<Record<string, unknown> | null> => {
  const mod = (await import(pathToFileURL(join(repoRoot, file)).href)) as Record<string, unknown>;
  const value = mod[name];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
};

/** 受け口 1 つ(categories か items)を読む */
async function readReceptacle<T>(
  repoRoot: string,
  dir: string,
  exportName: string,
): Promise<{ entries: MenuEntry<T>[]; orphans: OrphanOverride[] }> {
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return { entries: [], orphans: [] };
  const names = readdirSync(abs).sort();
  const entries: MenuEntry<T>[] = [];
  const overrides = new Map<string, string>();
  for (const name of names) {
    const full = join(abs, name);
    const file = relative(repoRoot, full).split("\\").join("/");
    if (statSync(full).isDirectory()) {
      const index = ["index.ts", "index.tsx"].find((n) => existsSync(join(full, n)));
      if (index)
        entries.push({
          name,
          file: `${file}/${index}`,
          definition: (await load(repoRoot, `${file}/${index}`, exportName)) as T | null,
        });
      continue;
    }
    const override = OVERRIDE_FILE.exec(name);
    if (override) {
      overrides.set(override[1], file);
      continue;
    }
    const item = ITEM_FILE.exec(name);
    if (item && !name.includes(".test."))
      entries.push({ name: item[1], file, definition: (await load(repoRoot, file, exportName)) as T | null });
  }
  const orphans: OrphanOverride[] = [];
  for (const [target, file] of overrides) {
    const entry = entries.find((e) => e.name === target);
    if (!entry) {
      orphans.push({ file, target });
      continue;
    }
    entry.override = { file, value: (await load(repoRoot, file, "override")) ?? {} };
  }
  return { entries, orphans };
}

export async function readMenuSnapshot(repoRoot = REPO_ROOT): Promise<MenuSnapshot> {
  const categories = await readReceptacle<MenuSnapshot["categories"][number]["definition"] & object>(
    repoRoot,
    `${MENU_DIR}/categories`,
    "category",
  );
  const items = await readReceptacle<MenuSnapshot["items"][number]["definition"] & object>(
    repoRoot,
    `${MENU_DIR}/items`,
    "item",
  );
  return { categories: categories.entries, items: items.entries, orphans: [...categories.orphans, ...items.orphans] };
}

/** ルート地図のページの住所(1 行 1 JSON の path) */
export function readRoutePaths(repoRoot = REPO_ROOT): string[] {
  return readFileSync(join(repoRoot, ROUTE_MAP), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => (JSON.parse(line) as { path: string }).path);
}

export const readGateRules = (): GateRuleView[] =>
  rules.map((rule) => ({ name: rule.name, pathPatterns: rule.pathPatterns, enabled: rule.enabled() }));

export const readSettingRows = (): AdminMenuRow[] => settingSectionRows();
