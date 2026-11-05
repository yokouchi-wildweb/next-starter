// 検査: 廃止した型（fieldType）の項目を生成前に止める。黙って捨てたり、知らない型として列名に出したりしない
// 廃止した型と移り先の案内は型の表（src/lib/domain/fields/fieldTypes.mjs の retired）が持つ

import { retiredFieldTypeMessage } from "../spec/fieldTypes.mjs";

/**
 * @returns {string | null} 問題があればエラー文、無ければ null
 */
export function checkRetiredFieldTypes(camel, config) {
  const hits = (config?.fields ?? []).filter((f) => retiredFieldTypeMessage(f?.fieldType) !== undefined);
  if (hits.length === 0) return null;
  return hits
    .map((f) => `[${camel}] fields "${f.name}": fieldType "${f.fieldType}" は廃止しました。${retiredFieldTypeMessage(f.fieldType)}`)
    .join("\n");
}
