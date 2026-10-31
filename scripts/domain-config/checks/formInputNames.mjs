// 検査: formInput の名前（domain.json と profile.json の fields・relations で共用）。
// 組み込み（src/lib/domain/fields/formInputs.mjs）か登録（src/wiring/formInputs/inputs/）のどちらかだけ。
// 知らない名前は画面に何も出ないので生成の前に止める。どの fieldType に合うかは見ない（登録は描画だけの約束）

import { FORM_INPUT_VALUES } from "../spec/domainJson.mjs";

/**
 * @param {{ fields?: object[], relations?: object[] }} config
 * @param {Set<string>} registered 登録名
 * @returns {string[]} 問題（空なら無し）
 */
export function formInputNameIssues(config, registered = new Set()) {
  const unknown = (formInput) => typeof formInput === "string" && !FORM_INPUT_VALUES.has(formInput) && !registered.has(formInput);
  const message = (where, formInput) =>
    `${where}: formInput "${formInput}" は組み込みにも登録にもありません（綴りを直すか、部品を src/wiring/formInputs/inputs/ に登録する）`;
  return [
    ...(config.fields ?? []).filter((field) => unknown(field?.formInput)).map((field) => message(`fields "${field.name}"`, field.formInput)),
    ...(config.relations ?? []).filter((relation) => unknown(relation?.formInput)).map((relation) => message(`relations "${relation.domain}"`, relation.formInput)),
  ];
}
