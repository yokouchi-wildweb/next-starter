// src/features/core/admin/menu/buildAdminMenu.ts
// 管理メニューの組み立て器(純関数。React を使わない。サイドバーと pnpm check admin-menu -- show が同じ物を呼ぶ)。
// 手順: カテゴリー・項目を解決(override は生成の一覧で重なり済み) → ロール(カテゴリー AND 項目 AND 行) →
//       出どころの展開(項目の位置に行を並べる) → 閉じた住所の行を隠す(厳密) → 行の無いカテゴリーを除く → order・key 順。
// 重複(同じ出どころ・同じ住所)は止めずに duplicates に出す。見え方は認可ではない(画面と API の守りは別)

import type {
  AdminMenuBuiltCategory,
  AdminMenuBuiltRow,
  AdminMenuCategoryDefinition,
  AdminMenuDomainEntry,
  AdminMenuDuplicate,
  AdminMenuHiddenEntry,
  AdminMenuItemDefinition,
  AdminMenuRow,
  AdminMenuSourceName,
  BuildAdminMenuInput,
  BuiltAdminMenu,
} from "./types";

/** allowRoles 未指定・空 = 全員。指定があればロールが含まれるときだけ */
const allows = (allowRoles: readonly string[] | undefined, role: string | undefined): boolean =>
  !allowRoles || allowRoles.length === 0 ? true : role !== undefined && allowRoles.includes(role);

/** order 昇順、同じ値は key 順 */
const byOrderThenKey = <T extends { order: number; key: string }>(a: T, b: T): number =>
  a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** 生成の管理一覧から「データ管理」の行(addToAdminDataMenu が true のドメイン、一覧の順) */
export function dataMenuRows(domains: Readonly<Record<string, AdminMenuDomainEntry>>): AdminMenuRow[] {
  return Object.values(domains)
    .filter((domain) => domain.addToAdminDataMenu)
    .map((domain) => ({ label: domain.label, href: domain.href }));
}

type Candidate = { key: string; itemKey: string; label: string; href: string; icon?: AdminMenuBuiltRow["icon"]; allowRoles?: readonly string[] };

/** 1 項目を行の候補にする(未知のドメインは null) */
function rowsOf(item: AdminMenuItemDefinition, input: BuildAdminMenuInput): Candidate[] | null {
  if ("source" in item) {
    return (input.sources[item.source] ?? []).map((row, index) => ({
      key: `${item.key}#${index}`,
      itemKey: item.key,
      label: row.label,
      href: row.href,
      icon: row.icon ?? item.icon,
      allowRoles: row.allowRoles,
    }));
  }
  if ("domain" in item) {
    const domain = Object.hasOwn(input.domains, item.domain) ? input.domains[item.domain] : undefined;
    if (!domain) return null;
    return [{ key: item.key, itemKey: item.key, label: item.label ?? domain.label, href: domain.href, icon: item.icon }];
  }
  return [{ key: item.key, itemKey: item.key, label: item.label, href: item.href, icon: item.icon }];
}

/** 重複: 同じ出どころを展開する項目が 2 つ以上 / 同じ住所の行が 2 つ以上(ロール・門番の前の宣言の上で数える) */
function findDuplicates(items: readonly AdminMenuItemDefinition[], resolved: ReadonlyMap<string, Candidate[]>): AdminMenuDuplicate[] {
  const duplicates: AdminMenuDuplicate[] = [];
  const bySource = new Map<AdminMenuSourceName, string[]>();
  for (const item of items) {
    if ("source" in item) bySource.set(item.source, [...(bySource.get(item.source) ?? []), item.key]);
  }
  for (const [source, itemKeys] of bySource) {
    if (itemKeys.length > 1) duplicates.push({ kind: "source", source, itemKeys });
  }
  const byHref = new Map<string, string[]>();
  for (const rows of resolved.values()) {
    for (const row of rows) byHref.set(row.href, [...(byHref.get(row.href) ?? []), row.key]);
  }
  for (const [href, rowKeys] of byHref) {
    if (rowKeys.length > 1) duplicates.push({ kind: "href", href, rowKeys });
  }
  return duplicates;
}

export function buildAdminMenu(input: BuildAdminMenuInput): BuiltAdminMenu {
  const hidden: AdminMenuHiddenEntry[] = [];
  const categoryList: AdminMenuCategoryDefinition[] = Object.values(input.categories).sort(byOrderThenKey);
  const itemList: AdminMenuItemDefinition[] = Object.values(input.items).sort(byOrderThenKey);

  // 宣言の上の行(重複の数えと、未知のドメインの記録)
  const resolved = new Map<string, Candidate[]>();
  for (const item of itemList) {
    const rows = rowsOf(item, input);
    if (rows === null) {
      hidden.push({ kind: "item", key: item.key, reason: "unknown-domain" });
      continue;
    }
    resolved.set(item.key, rows);
  }
  const duplicates = findDuplicates(itemList, resolved);

  const known = new Set(categoryList.map((category) => category.key));
  for (const item of itemList) {
    if (!known.has(item.category) && resolved.has(item.key)) hidden.push({ kind: "item", key: item.key, reason: "unknown-category" });
  }

  const categories: AdminMenuBuiltCategory[] = [];
  for (const category of categoryList) {
    if (category.hidden) {
      hidden.push({ kind: "category", key: category.key, reason: "category-hidden" });
      continue;
    }
    if (!allows(category.allowRoles, input.role)) {
      hidden.push({ kind: "category", key: category.key, reason: "category-role" });
      continue;
    }
    const rows: AdminMenuBuiltRow[] = [];
    for (const item of itemList.filter((i) => i.category === category.key)) {
      const candidates = resolved.get(item.key);
      if (!candidates) continue;
      if (item.hidden) {
        hidden.push({ kind: "item", key: item.key, reason: "item-hidden" });
        continue;
      }
      if (!allows(item.allowRoles, input.role)) {
        hidden.push({ kind: "item", key: item.key, reason: "role" });
        continue;
      }
      for (const row of candidates) {
        if (!allows(row.allowRoles, input.role)) {
          hidden.push({ kind: "row", key: row.key, reason: "role", href: row.href });
          continue;
        }
        if (input.isClosed(row.href)) {
          hidden.push({ kind: "row", key: row.key, reason: "closed", href: row.href });
          continue;
        }
        rows.push({ key: row.key, itemKey: row.itemKey, label: row.label, href: row.href, icon: row.icon });
      }
    }
    if (rows.length === 0) {
      hidden.push({ kind: "category", key: category.key, reason: "empty-category" });
      continue;
    }
    categories.push({ key: category.key, label: category.label, icon: category.icon, rows });
  }
  return { categories, hidden, duplicates };
}
