// src/features/core/user/mypageMenu/buildMypageMenu.ts
// マイページのメニューの組み立て器(純関数。React を使わない)。
// 手順: hidden を除く → 操作の項目を渡された結び先に結ぶ(結び先の無い操作は除く) → order・key 順。
// 閉じた機能の住所は組み立て器では見ない(描く RichMenuCard の棚の Link が描かない)。見え方は認可ではない

import type {
  BuildMypageMenuInput,
  BuiltMypageMenu,
  MypageMenuBuiltRow,
  MypageMenuHiddenEntry,
  MypageMenuItem,
} from "@/features/core/user/types";

/** order 昇順、同じ値は key 順 */
const byOrderThenKey = (a: MypageMenuItem, b: MypageMenuItem): number =>
  a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export function buildMypageMenu(input: BuildMypageMenuInput): BuiltMypageMenu {
  const rows: MypageMenuBuiltRow[] = [];
  const hidden: MypageMenuHiddenEntry[] = [];
  for (const item of Object.values(input.items).sort(byOrderThenKey)) {
    if (item.hidden) {
      hidden.push({ key: item.key, reason: "item-hidden" });
      continue;
    }
    const base = { key: item.key, description: item.description, icon: item.icon, variant: item.variant };
    if (item.action !== undefined) {
      const binding = Object.hasOwn(input.actions, item.action) ? input.actions[item.action] : undefined;
      if (!binding) {
        hidden.push({ key: item.key, reason: "unknown-action" });
        continue;
      }
      rows.push({
        ...base,
        kind: "action",
        action: item.action,
        title: binding.pending ? (item.pendingTitle ?? item.title) : item.title,
        onClick: () => void binding.run(),
        disabled: binding.pending,
      });
      continue;
    }
    rows.push({ ...base, kind: "link", title: item.title, href: item.href, showChevron: item.showChevron });
  }
  return { rows, hidden };
}
