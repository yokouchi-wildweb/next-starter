// 検査: 廃止した型（fieldType）の項目を生成前に止める。黙って捨てたり、知らない型として列名に出したりしない

/** 廃止した fieldType → 移り先の案内 */
const RETIRED_FIELD_TYPES = {
  mediaUploaderMulti:
    '複数のメディアは mediaCollection（集まり）に移してください。手順: src/lib/crud/README.md「既存の mediaUploaderMulti 列からの移行」',
};

/**
 * @returns {string | null} 問題があればエラー文、無ければ null
 */
export function checkRetiredFieldTypes(camel, config) {
  const hits = (config?.fields ?? []).filter((f) => Object.hasOwn(RETIRED_FIELD_TYPES, f?.fieldType));
  if (hits.length === 0) return null;
  return hits
    .map((f) => `[${camel}] fields "${f.name}": fieldType "${f.fieldType}" は廃止しました。${RETIRED_FIELD_TYPES[f.fieldType]}`)
    .join("\n");
}
