// 編集画面の「前後の項目へ移る」の候補と表示名(React 非依存の部分)。useDomainItemNavigation が使う。
// テスト: ./itemNavigation.test.mjs(pnpm test:crud-hooks)

/** 候補の並び: 今の項目が候補(検索の先頭の数件)に無ければ先頭に足す(選択欄が今の値を表示できるように) */
export function withCurrentItem<T extends { id: string }>(items: readonly T[], current: T | undefined): T[] {
  if (!current || items.some((item) => item.id === current.id)) return [...items];
  return [current, ...items];
}

/** 候補の表示名: labelField の値 → name → title → id の順 */
export function itemLabelOf<T extends { id: string }>(item: T, labelField?: keyof T & string): string {
  if (labelField) {
    const value = item[labelField];
    return value != null ? String(value) : "";
  }
  const record = item as Record<string, unknown>;
  if (typeof record.name === "string" && record.name) return record.name;
  if (typeof record.title === "string" && record.title) return record.title;
  return item.id;
}
