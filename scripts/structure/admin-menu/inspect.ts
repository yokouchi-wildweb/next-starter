// scripts/structure/admin-menu/inspect.ts
// 管理メニューの点検と表示の中身(純関数。ファイルを読まない: 集めるのは ./collect.ts)。
// 点検(pnpm check admin-menu): 知らないカテゴリー・知らないドメイン・相手の無い上書き・allowRoles を広げる上書き・
//   route-map に無い住所・定義の key とファイル名の食い違い
// 表示(pnpm check admin-menu -- show): ロールごとの木(行ごとに当たる規則か 常時)・重複・隠した物と理由
// 仕組み: src/features/core/admin/menu/README.md

import { buildAdminMenu, dataMenuRows } from "@/features/core/admin/menu/buildAdminMenu";
import type {
  AdminMenuCategoryDefinition,
  AdminMenuDomainEntry,
  AdminMenuItemDefinition,
  AdminMenuRow,
  BuiltAdminMenu,
} from "@/features/core/admin/menu/types";
import { matchesPath } from "@/lib/pathPattern/index.mjs";

/** 受け口の 1 項目(ファイル名 = 名前、定義、隣の上書き) */
export type MenuEntry<T> = {
  name: string;
  file: string;
  definition: T | null;
  override?: { file: string; value: Record<string, unknown> };
};
/** 受け口の上書きのうち相手の無いもの */
export type OrphanOverride = { file: string; target: string };

export type MenuSnapshot = {
  categories: MenuEntry<AdminMenuCategoryDefinition>[];
  items: MenuEntry<AdminMenuItemDefinition>[];
  orphans: OrphanOverride[];
};

/** 門番の規則の要るところだけ(名前・住所・今の開閉) */
export type GateRuleView = { name: string; pathPatterns: readonly string[]; enabled: boolean };

const pathOf = (href: string): string => href.replace(/[?#].*$/, "") || "/";

const merged = <T>(entry: MenuEntry<T>): T | null =>
  entry.definition === null ? null : ({ ...entry.definition, ...(entry.override?.value ?? {}) } as T);

/** ルート地図の住所(動的セグメント [x]・[...x]・[[...x]] を含む)に当たるか */
export function routeExists(href: string, routePaths: readonly string[]): boolean {
  const segments = pathOf(href).split("/").filter(Boolean);
  return routePaths.some((route) => {
    const parts = route.split("/").filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (/^\[\[\.\.\..+\]\]$/.test(part)) return true;
      if (/^\[\.\.\..+\]$/.test(part)) return segments.length > i;
      if (i >= segments.length) return false;
      if (!/^\[.+\]$/.test(part) && part !== segments[i]) return false;
    }
    return parts.length === segments.length;
  });
}

/** 住所に当たる規則(並びの順)。内部の住所だけ(外部 URL・// は当たらない) */
export const matchingRules = (href: string, rules: readonly GateRuleView[]): GateRuleView[] =>
  href.startsWith("/") && !href.startsWith("//") ? rules.filter((rule) => rule.pathPatterns.some((p) => matchesPath(pathOf(href), p))) : [];

/** 行を覆う規則: 閉じた規則が当たればその最初、無ければ当たる最初の規則。当たらなければ null = 常時 */
export const coveringRule = (href: string, rules: readonly GateRuleView[]): GateRuleView | null => {
  const hits = matchingRules(href, rules);
  return hits.find((rule) => !rule.enabled) ?? hits[0] ?? null;
};

/** allowRoles を広げる上書きか(上流に絞りがあり、上書きがその外のロールを含む / 空にする) */
const widens = (upstream: readonly string[] | undefined, override: unknown): boolean => {
  if (!upstream || upstream.length === 0) return false;
  if (!Array.isArray(override)) return override !== undefined;
  return override.length === 0 || override.some((role) => !upstream.includes(role));
};

/** 点検(空 = 通る)。1 件 1 行 */
export function checkAdminMenu(
  snapshot: MenuSnapshot,
  domains: Readonly<Record<string, AdminMenuDomainEntry>>,
  routePaths: readonly string[],
): string[] {
  const problems: string[] = [];
  for (const orphan of snapshot.orphans) problems.push(`${orphan.file}: 相手の ${orphan.target} が受け口に無い上書き`);
  const entries = [...snapshot.categories, ...snapshot.items] as MenuEntry<{
    key: string;
    allowRoles?: readonly string[];
  }>[];
  for (const entry of entries) {
    if (entry.definition === null) {
      problems.push(`${entry.file}: 定義(export const category / item)を読めない`);
      continue;
    }
    if (entry.definition.key !== entry.name)
      problems.push(
        `${entry.file}: key "${entry.definition.key}" がファイル名 ${entry.name} と違う(key = ファイル名 = 上書きの相手の名前)`,
      );
    if (entry.override && widens(entry.definition.allowRoles, entry.override.value.allowRoles)) {
      problems.push(
        `${entry.override.file}: allowRoles を広げている(上流 [${entry.definition.allowRoles?.join(", ")}] の中だけに絞る)`,
      );
    }
  }
  const categoryKeys = new Set(snapshot.categories.map((c) => merged(c)?.key).filter(Boolean));
  for (const entry of snapshot.items) {
    const item = merged(entry);
    if (item === null) continue;
    if (!categoryKeys.has(item.category))
      problems.push(`${entry.override?.file ?? entry.file}: カテゴリー "${item.category}" が無い`);
    if ("domain" in item && !Object.hasOwn(domains, item.domain)) {
      problems.push(
        `${entry.file}: ドメイン "${item.domain}" が管理一覧(@/registry/adminDomains)に無い(管理一覧の画面が無いなら link で書く)`,
      );
    }
    const href =
      "href" in item
        ? item.href
        : "domain" in item && Object.hasOwn(domains, item.domain)
          ? domains[item.domain].href
          : null;
    if (href !== null && pathOf(href).startsWith("/admin") && !routeExists(href, routePaths)) {
      problems.push(`${entry.override?.file ?? entry.file}: 住所 ${href} のページが src/app/route-map.jsonl に無い`);
    }
  }
  return problems;
}

export type ShowMode = "now" | "all" | "none";

/** 表示の 1 ロール分(組み立て器の結果) */
export function buildForRole(
  snapshot: MenuSnapshot,
  domains: Readonly<Record<string, AdminMenuDomainEntry>>,
  settingRows: readonly AdminMenuRow[],
  rules: readonly GateRuleView[],
  mode: ShowMode,
  role: string,
): BuiltAdminMenu {
  const keyed = <T extends { key: string }>(list: MenuEntry<T>[]) =>
    Object.fromEntries(
      list
        .map((e) => merged(e))
        .filter((d): d is T => d !== null)
        .map((d) => [d.key, d]),
    );
  const closedRules = mode === "all" ? rules : mode === "none" ? [] : rules.filter((r) => !r.enabled);
  return buildAdminMenu({
    categories: keyed(snapshot.categories),
    items: keyed(snapshot.items),
    domains,
    sources: { dataMenu: dataMenuRows(domains), settingSections: settingRows },
    role,
    isClosed: (href) => matchingRules(href, closedRules).length > 0,
  });
}

/** 表示の文字列(1 ロール分) */
export function renderForRole(
  menu: BuiltAdminMenu,
  rules: readonly GateRuleView[],
  role: string,
  mode: ShowMode,
): string[] {
  const ruleLabel = (href: string) => {
    if (mode !== "now") return matchingRules(href, rules).map((r) => r.name).join(" / ") || "常時";
    const rule = coveringRule(href, rules);
    return rule === null ? "常時" : `${rule.name}(${rule.enabled ? "開" : "閉"})`;
  };
  const lines = [`== ${role}  (門番: ${mode === "now" ? "今の開閉" : mode === "all" ? "全部閉じた" : "全部開いた"})`];
  for (const category of menu.categories) {
    lines.push(`${category.label}  [${category.key}]`);
    for (const row of category.rows) lines.push(`  - ${row.label}  ${row.href}  ${ruleLabel(row.href)}  [${row.key}]`);
  }
  if (menu.categories.length === 0) lines.push("(描くカテゴリーなし)");
  if (menu.duplicates.length > 0) {
    lines.push("重複(止めない):");
    for (const d of menu.duplicates)
      lines.push(
        d.kind === "source"
          ? `  - 出どころ ${d.source} を ${d.itemKeys.join(", ")} が展開`
          : `  - 住所 ${d.href}: ${d.rowKeys.join(", ")}`,
      );
  }
  if (menu.hidden.length > 0) {
    lines.push("描かない物:");
    for (const h of menu.hidden)
      lines.push(`  - ${h.kind} ${h.key}: ${h.reason}${h.href ? `  ${h.href}  ${ruleLabel(h.href)}` : ""}`);
  }
  return lines;
}
