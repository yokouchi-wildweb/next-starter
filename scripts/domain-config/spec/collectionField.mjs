// 主の集まりの項目（fieldType mediaCollection）の純関数: 従属ドメインの既定の名前・domain.json の項目の組み立て・型の選択肢の並び。
// dc:init / dc:add の問い（questions/fields/collection.mjs）と、従属の domain.json を書き出す生成が同じ関数を使う。

import { toSnakeCase } from "../../../src/utils/stringCase.mjs";
import { FORM_INPUTS } from "./formInputs.mjs";

export const DEFAULT_COLLECTION_MAX_ITEMS = 10;

const SNAKE_CASE_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

/** ドメイン名として使える snake_case か */
export const isSnakeCaseName = (name) => typeof name === "string" && SNAKE_CASE_NAME.test(name);

/**
 * 従属ドメインの既定の名前。項目名が s で終われば末尾の s を 1 つ外して singular、項目名のまま plural にする。
 * それ以外は singular だけを返す（plural は生成時の推定に任せる）
 * @returns {{ singular: string, plural?: string }}
 */
export function defaultChildName(parentSingular, fieldName) {
  const parent = toSnakeCase(parentSingular);
  const field = toSnakeCase(fieldName);
  if (field.endsWith("s")) return { singular: `${parent}_${field.slice(0, -1)}`, plural: `${parent}_${field}` };
  return { singular: `${parent}_${field}` };
}

/**
 * 問いの答えから domain.json の 1 項目を組む。必須なら複製は常に true（必須 × duplicate: false は生成エラーのため）。
 * 従属の plural は項目に持たせない
 */
export function buildCollectionField({ name, label, childSingular, required, maxItems, reorderable, duplicate }) {
  return {
    name,
    label,
    fieldType: "mediaCollection",
    formInput: "mediaUploaderMulti",
    required: Boolean(required),
    reorderable: Boolean(reorderable),
    collection: { domain: childSingular, maxItems, duplicate: required ? true : Boolean(duplicate) },
  };
}

/** dc:init / dc:add の「フィールドの型」の選択肢（spec/formInputs.mjs の表のキー順。Neon は集まりが mediaUploaderMulti より先） */
export function fieldTypeChoices(dbEngine) {
  return Object.keys(FORM_INPUTS[dbEngine] ?? {});
}
