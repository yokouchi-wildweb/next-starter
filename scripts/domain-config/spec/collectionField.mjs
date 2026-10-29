// 主の集まりの項目（fieldType mediaCollection）の純関数: 従属ドメインの既定の名前と snake_case の判定。
// 従属の domain.json を書き出す生成（render/collections）と名前の検査（checks/names.mjs）が使う。

import { toSnakeCase } from "../../../src/utils/stringCase.mjs";

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
