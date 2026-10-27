// components/ のテンプレート一覧（生成順 = この配列の順）。
// template = src/features/_template/components/ からの相対パス、output = 出力の相対パス（省略 = template と同じ）

/**
 * @typedef {object} ComponentSpec
 * @property {string} key      選択 CLI（dc:generate:component）で使う識別子
 * @property {string} template テンプレートの相対パス（domain.json で変わるものは templateFor）
 * @property {(config: object | null) => string} [templateFor] 設定でテンプレートを切り替える
 * @property {string} [output] 出力の相対パス（templateFor のときに固定名で出す）
 * @property {string} [when]   生成条件になる domain.json のキー
 * @property {"fields" | "autoSave" | "duplicateButton"} [tweak] 本文の特別な処理
 */

/** @type {ComponentSpec[]} */
export const COMPONENT_SPECS = [
  { key: "adminCreate", template: "Admin__Domain__Create/index.tsx" },
  { key: "adminEdit", template: "Admin__Domain__Edit/index.tsx" },
  { key: "adminListIndex", template: "Admin__Domain__List/index.tsx" },
  { key: "adminListHeader", template: "Admin__Domain__List/Header.tsx" },
  {
    key: "adminListTable",
    template: "Admin__Domain__List/Table.tsx",
    templateFor: (config) => (config?.useDetailModal ? "Admin__Domain__List/Table.withDetailModal.tsx" : "Admin__Domain__List/Table.tsx"),
    output: "Admin__Domain__List/Table.tsx",
    tweak: "duplicateButton",
  },
  { key: "createForm", template: "common/Create__Domain__Form.tsx" },
  { key: "editForm", template: "common/Edit__Domain__Form.tsx", tweak: "autoSave" },
  { key: "domainForm", template: "common/__Domain__Form.tsx" },
  { key: "domainFields", template: "common/__Domain__Fields.tsx", tweak: "fields" },
  { key: "detailModal", template: "common/__Domain__DetailModal.tsx", when: "useDetailModal" },
  { key: "adminSort", template: "Admin__Domain__Sort/index.tsx", when: "sortOrderField" },
];

/** domain.json の設定で生成対象になるコンポーネント */
export function componentSpecsFor(config) {
  return COMPONENT_SPECS.filter((spec) => !spec.when || Boolean(config?.[spec.when]));
}
