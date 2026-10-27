// hooks/ のテンプレート一覧。どのフックをいつ生成するかの表（生成順 = この配列の順）。
// 条件付きフックの `when` は domain.json のキー（真なら生成）。特別な置換が要るものは `render` を持つ

/**
 * @typedef {object} HookSpec
 * @property {string} key       選択 CLI（dc:generate:hook）で使う識別子
 * @property {string} template  src/features/_template/hooks/ のファイル名
 * @property {string} [when]    生成条件になる domain.json のキー
 * @property {boolean} [drizzleOnly] Firestore では生成しない
 */

/** @type {HookSpec[]} */
export const HOOK_SPECS = [
  { key: "get", template: "use__Domain__.ts" },
  { key: "list", template: "use__Domain__List.ts" },
  { key: "search", template: "useSearch__Domain__.ts" },
  { key: "create", template: "useCreate__Domain__.ts" },
  { key: "update", template: "useUpdate__Domain__.ts" },
  { key: "upsert", template: "useUpsert__Domain__.ts" },
  { key: "delete", template: "useDelete__Domain__.ts" },
  { key: "bulkDeleteByIds", template: "useBulkDeleteByIds__Domain__.ts" },
  { key: "bulkDeleteByQuery", template: "useBulkDeleteByQuery__Domain__.ts" },
  { key: "bulkUpsert", template: "useBulkUpsert__Domain__.ts" },
  { key: "bulkUpdate", template: "useBulkUpdate__Domain__.ts" },
  { key: "count", template: "useCount__Domain__.ts" },
  // replaceByQuery は Drizzle 専用（Firestore アダプタは未対応・FROZEN）
  { key: "replaceByQuery", template: "useReplaceByQuery__Domain__.ts", drizzleOnly: true },
  { key: "viewModal", template: "use__Domain__ViewModal.ts", when: "useDetailModal" },
  { key: "duplicate", template: "useDuplicate__Domain__.ts", when: "useDuplicateButton" },
  { key: "restore", template: "useRestore__Domain__.ts", when: "useSoftDelete" },
  { key: "hardDelete", template: "useHardDelete__Domain__.ts", when: "useSoftDelete" },
  { key: "reorder", template: "useReorder__Domain__.ts", when: "sortOrderField" },
  { key: "searchForSorting", template: "useSearchForSorting__Domain__.ts", when: "sortOrderField" },
];

/** domain.json の設定で生成対象になるフック */
export function hookSpecsFor(config) {
  return HOOK_SPECS.filter((spec) => {
    if (spec.drizzleOnly && config?.dbEngine === "Firestore") return false;
    if (spec.when) return Boolean(config?.[spec.when]);
    return true;
  });
}
